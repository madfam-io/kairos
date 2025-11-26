import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Circle } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PitchContourGraphProps {
  referenceContour?: number[];
  userContour?: number[];
  segmentScores?: number[];
  width?: number;
  height?: number;
  showLabels?: boolean;
}

export function PitchContourGraph({
  referenceContour,
  userContour,
  segmentScores,
  width = SCREEN_WIDTH - 40,
  height = 200,
  showLabels = true,
}: PitchContourGraphProps) {
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Calculate bounds
  const { minY, maxY, pathRef, pathUser, segmentPositions } = useMemo(() => {
    const allValues = [
      ...(referenceContour || []),
      ...(userContour || []),
    ].filter((v) => v !== 0 && !isNaN(v));

    if (allValues.length === 0) {
      return { minY: -5, maxY: 5, pathRef: '', pathUser: '', segmentPositions: [] };
    }

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min || 1;
    const paddedMin = min - range * 0.1;
    const paddedMax = max + range * 0.1;

    const createPath = (contour: number[] | undefined) => {
      if (!contour || contour.length === 0) return '';

      const points = contour.map((y, i) => {
        const x = padding.left + (i / (contour.length - 1)) * graphWidth;
        const yPos = padding.top + (1 - (y - paddedMin) / (paddedMax - paddedMin)) * graphHeight;
        return `${x},${yPos}`;
      });

      return `M ${points.join(' L ')}`;
    };

    // Calculate segment positions for score indicators
    const numSegments = segmentScores?.length || 0;
    const segPos = [];
    for (let i = 0; i < numSegments; i++) {
      const x = padding.left + ((i + 0.5) / numSegments) * graphWidth;
      segPos.push(x);
    }

    return {
      minY: paddedMin,
      maxY: paddedMax,
      pathRef: createPath(referenceContour),
      pathUser: createPath(userContour),
      segmentPositions: segPos,
    };
  }, [referenceContour, userContour, segmentScores, graphWidth, graphHeight]);

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return '#22c55e'; // Green
    if (score >= 0.6) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <Line
            key={`h-${ratio}`}
            x1={padding.left}
            y1={padding.top + ratio * graphHeight}
            x2={width - padding.right}
            y2={padding.top + ratio * graphHeight}
            stroke="#374151"
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        ))}

        {/* Y-axis labels */}
        {showLabels && [0, 0.5, 1].map((ratio) => {
          const value = maxY - ratio * (maxY - minY);
          return (
            <SvgText
              key={`label-${ratio}`}
              x={padding.left - 5}
              y={padding.top + ratio * graphHeight + 4}
              fontSize={10}
              fill="#9ca3af"
              textAnchor="end"
            >
              {value.toFixed(1)}
            </SvgText>
          );
        })}

        {/* Reference contour (gray, dashed) */}
        {pathRef && (
          <Path
            d={pathRef}
            stroke="#6b7280"
            strokeWidth={2}
            strokeDasharray="6,3"
            fill="none"
          />
        )}

        {/* User contour (colored based on accuracy) */}
        {pathUser && (
          <Path
            d={pathUser}
            stroke="#6366f1"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Segment score indicators */}
        {segmentScores && segmentPositions.map((x, i) => (
          <Circle
            key={`score-${i}`}
            cx={x}
            cy={height - 12}
            r={8}
            fill={getScoreColor(segmentScores[i])}
          />
        ))}

        {/* Labels */}
        {showLabels && (
          <>
            <SvgText
              x={width / 2}
              y={height - 5}
              fontSize={10}
              fill="#9ca3af"
              textAnchor="middle"
            >
              Time
            </SvgText>
            <SvgText
              x={12}
              y={height / 2}
              fontSize={10}
              fill="#9ca3af"
              textAnchor="middle"
              transform={`rotate(-90, 12, ${height / 2})`}
            >
              Pitch (semitones)
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
  },
});
