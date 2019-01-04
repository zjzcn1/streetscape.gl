// Copyright (c) 2019 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// @flow
import React, {Component} from 'react';
import PropTypes from 'prop-types';

import {_MapContext as MapContext} from 'react-map-gl';

import PerspectivePopup from './perspective-popup';

import {getCentroid} from '../../utils/geometry';
import {resolveCoordinateTransform, positionToLngLat} from '../../utils/transform';

const renderDefaultObjectLabel = ({id, isSelected}) => isSelected && <div>ID: {id}</div>;

export default class ObjectLabelsOverlay extends Component {
  static propTypes = {
    objectSelection: PropTypes.object,
    frame: PropTypes.object,
    metadata: PropTypes.object,
    xvizStyleParser: PropTypes.object,

    renderObjectLabel: PropTypes.func,
    style: PropTypes.object,
    getTransformMatrix: PropTypes.func
  };

  static defaultProps = {
    objectSelection: {},
    renderObjectLabel: renderDefaultObjectLabel,
    style: {}
  };

  constructor(props) {
    super(props);
    this.state = {
      coordinateProps: this._getCoordinateProps(props)
    };
  }

  componentWillReceiveProps(nextProps) {
    const {frame} = nextProps;

    if (frame && frame !== this.props.frame) {
      this.setState({
        coordinateProps: this._getCoordinateProps(nextProps)
      });
    }
  }

  _getCoordinateProps(props) {
    const {frame, metadata, getTransformMatrix} = props;

    if (!frame) {
      return null;
    }

    const coordinateProps = {};

    for (const streamName in frame.streams) {
      const features = frame.streams[streamName].features;

      if (!features || !features[0] || !features[0].id || features[0].type !== 'polygon') {
        // not an object stream
        continue; // eslint-disable-line
      }

      const streamMetadata = (metadata.streams && metadata.streams[streamName]) || {};
      coordinateProps[streamName] = resolveCoordinateTransform(
        frame,
        streamMetadata,
        getTransformMatrix
      );
    }

    return coordinateProps;
  }

  _renderPerspectivePopup = (object, streamName) => {
    const {objectSelection, frame, xvizStyleParser, style, renderObjectLabel} = this.props;

    const isSelected = Boolean(objectSelection[object.id]);
    const stylesheet = xvizStyleParser.getStylesheet(streamName);
    const styleProps = {
      id: object.id,
      isSelected,
      object,
      stylesheet
    };

    const labelContent = renderObjectLabel(styleProps);

    if (!labelContent) {
      return null;
    }

    const trackingPoint = positionToLngLat(
      getCentroid(object.vertices),
      this.state.coordinateProps[streamName]
    );

    const objectHeight = stylesheet.getProperty('height', object);
    trackingPoint[2] += objectHeight || 0;

    // compensate for camera offset
    if (frame.origin) {
      trackingPoint[2] -= frame.origin[2];
    }

    return (
      <PerspectivePopup
        key={object.id}
        longitude={trackingPoint[0]}
        latitude={trackingPoint[1]}
        altitude={trackingPoint[2]}
        anchor="bottom-left"
        dynamicPosition={true}
        styleProps={styleProps}
        style={style}
        sortByDepth={true}
        closeButton={false}
        closeOnClick={false}
      >
        {labelContent}
      </PerspectivePopup>
    );
  };

  render() {
    const {frame, viewport, renderObjectLabel} = this.props;
    const {coordinateProps} = this.state;

    if (!frame || !coordinateProps || !renderObjectLabel) {
      return null;
    }

    return (
      <MapContext.Provider value={{viewport}}>
        {Object.keys(coordinateProps).map(streamName =>
          frame.streams[streamName].features.map(f => this._renderPerspectivePopup(f, streamName))
        )}
      </MapContext.Provider>
    );
  }
}
