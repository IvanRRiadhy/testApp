import React, { useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Rect,
  Circle as KonvaCircle,
  Arrow,
  Line,
} from "react-konva";
import { KonvaEventObject } from "konva/lib/Node";

interface Props {
  beaconData: Record<string, { key: string; distance: number }[]>;
}

interface Square {
  id: string;
  x: number;
  y: number;
  color: string;
}

interface Circle {
  id: string;
  x: number;
  y: number;
  color: string;
  closestDistance: number;
  closestReceiver: string;
  secondClosestDistance: number;
  secondClosestReceiver: string;
  lastClosestReceiver: string;
}
type BeaconData = {
  key: string;
  distance: number;
};

const Initial_Size = 50;

const Squares: React.FC<Props> = ({ beaconData }) => {
  const [squares, setSquares] = useState<Square[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const squarePositions = useRef<Map<string, { x: number; y: number }>>(
    new Map()
  );
  const circlePositions = useRef<Map<string, { x: number; y: number }>>(
    new Map()
  );
  const animationRef = useRef<number | null>(null);

  //Creating and Updating Circles and Squares
  useEffect(() => {
    const generateCirclesAndSquares = () => {
      const newCircles = Object.keys(beaconData).map((beacon, index) => {
        let closestEntry: BeaconData | null = beaconData[beacon][0] || null;
        let secondClosestEntry: BeaconData | null =
          beaconData[beacon][1] || null;
        let lastClosestEntry: BeaconData | null = closestEntry || null;

        beaconData[beacon].forEach((entry) => {
          if (entry.distance > 0) {
            if (!closestEntry || entry.distance < closestEntry.distance) {
              secondClosestEntry = closestEntry;

              closestEntry = entry;
            } else if (
              secondClosestEntry === null ||
              entry.distance < secondClosestEntry.distance
            ) {
              secondClosestEntry = entry;
            }
          }
        });
        // if (
        //   !lastClosestEntry ||
        //   (closestEntry !== null && closestEntry.key !== lastClosestEntry.key)
        // )
        //   lastClosestEntry = closestEntry;
        const previousPosition = circlePositions.current.get(beacon);
        return {
          id: beacon,
          x: previousPosition ? previousPosition.x : 0,
          y: previousPosition ? previousPosition.y : 0,
          color: getUniqueColor(index),
          closestDistance: closestEntry ? closestEntry.distance * 100 : 0,
          closestReceiver: closestEntry?.key || "N/A",
          secondClosestDistance: secondClosestEntry
            ? secondClosestEntry.distance * 100
            : 0,
          secondClosestReceiver: secondClosestEntry?.key || "N/A",
          lastClosestReceiver: lastClosestEntry?.key || "N/A",
        };
      });

      const allKeys = Object.values(beaconData)
        .flat()
        .map((entry) => entry.key);
      const uniqueKeys = [...new Set(allKeys)];

      const newSquares = uniqueKeys.map((key, index) => {
        const existingPosition = squarePositions.current.get(key);
        return {
          id: key,
          x: existingPosition ? existingPosition.x : 100 + index * 100,
          y: existingPosition ? existingPosition.y : 300,
          color: getUniqueColor(index + 10),
        };
      });

      setCircles(newCircles);
      setSquares(newSquares);
    };

    generateCirclesAndSquares();
  }, [JSON.stringify(beaconData)]); // Stringify to track deep changes
const [dotGroups, setDotGroups] = useState<
  { pair: string; dots: { x: number; y: number }[] }[]
>([]);
  //Square Dragging Handler
  const handleSquareDragMove = (e: KonvaEventObject<DragEvent>, id: string) => {
    let { x, y } = e.target.position();
    setSquares((prevSquares) =>
      prevSquares.map((square) =>
        square.id === id ? { ...square, x, y } : square
      )
    );
    squarePositions.current.set(id, { x, y });
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>, id: string) => {
    const { x, y } = e.target.position();
    const snappedX = snapToGrid(x);
    const snappedY = snapToGrid(y);

    setSquares((prevSquares) =>
      prevSquares.map((square) =>
        square.id === id ? { ...square, x: snappedX, y: snappedY } : square
      )
    );
    squarePositions.current.set(id, { x: snappedX, y: snappedY });
  };

  const handleCircleDragMove = (e: KonvaEventObject<DragEvent>, id: string) => {
    const { x, y } = e.target.position();

    for (const startSquare of squares) {
      for (const endSquare of squares) {
        if (startSquare.id !== endSquare.id) {
          const arrowPoints = getEdgePosition(startSquare, endSquare);
          if (isCircleOnArrow(x, y, arrowPoints)) {
            console.log(
              `Circle ${id} is on the arrow at position: (${x}, ${y})`
            );
          }
        }
      }
    }

    setCircles(
      circles.map((circle) => (circle.id === id ? { ...circle, x, y } : circle))
    );
  };

  //Getting unique color
  const getUniqueColor = (index: number) => {
    const hue = (index * 137) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  };

  //Getting Position of each Receiver to make the Start point and End point of the Arrows
  const getEdgePosition = (start: Square, end: Square): number[] => {
    const size = Initial_Size;

    let startX = start.x + size / 2;
    let startY = start.y + size / 2;
    let endX = end.x + size / 2;
    let endY = end.y + size / 2;

    const dx = endX - startX;
    const dy = endY - startY;
    let angle = Math.atan2(-dy, dx);

    startX = startX + -size * Math.cos(angle + Math.PI);
    startY = startY + size * Math.sin(angle + Math.PI);
    endX = endX + -size * Math.cos(angle);
    endY = endY + size * Math.sin(angle);

    return [startX, startY, endX, endY];
  };

  //Detecting if Beacon is on Arrow
  const isCircleOnArrow = (
    circleX: number,
    circleY: number,
    arrowPoints: number[]
  ): boolean => {
    const [x1, y1, x2, y2] = arrowPoints;
    const distance = getDistanceToLine(circleX, circleY, x1, y1, x2, y2);

    const treshold = 25;
    return distance <= treshold;
  };

  //Finding the nearest Arrow from Beacon
  const getDistanceToLine = (
    circleX: number,
    circleY: number,
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): number => {
    const A = circleX - startX;
    const B = circleY - startY;
    const C = endX - startX;
    const D = endY - startY;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    const param = lenSq !== 0 ? dot / lenSq : -1;

    let closestX, closestY;
    if (param < 0) {
      closestX = startX;
      closestY = startY;
    } else if (param > 1) {
      closestX = endX;
      closestY = endY;
    } else {
      closestX = startX + param * C;
      closestY = startY + param * D;
    }

    const dx = circleX - closestX;
    const dy = circleY - closestY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  //Making the Beacon overlap with Arrow
  const getPointOnArrow = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    distance: number
  ) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) {
      return { x: start.x, y: start.y };
    }

    const ratio = distance / length;

    return {
      x: start.x + dx * ratio,
      y: start.y + dy * ratio,
    };
  };

  //Positioning Beacon in Arrows according to Closest Distance
  useEffect(() => {
    const updatePositions = () => {
      setCircles((prevCircles) =>
        prevCircles.map((circle) => {
          if (
            circle.closestReceiver === "" ||
            circle.lastClosestReceiver === ""
          )
            return circle;
          const closestSquare = squares.find(
            (sq) => sq.id === circle.closestReceiver
          );
          const lastClosestSquare = squares.find(
            (sq) => sq.id === circle.lastClosestReceiver
          );
          if (!closestSquare || !lastClosestSquare) return circle;

          const newPos = getPointOnArrow(
            {
              x: closestSquare.x + Initial_Size / 2,
              y: closestSquare.y + Initial_Size / 2,
            },
            {
              x: lastClosestSquare.x + Initial_Size / 2,
              y: lastClosestSquare.y + Initial_Size / 2,
            },
            circle.closestDistance
          );

          return { ...circle, x: newPos.x, y: newPos.y };
        })
      );
      animationRef.current = requestAnimationFrame(updatePositions);
    };
    animationRef.current = requestAnimationFrame(updatePositions);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [beaconData]);

  //Warning function
  useEffect(() => {
    circles.map((circle) => {
      for (const startSquare of squares) {
        for (const endSquare of squares) {
          if (startSquare.id !== endSquare.id) {
            const arrowPoints = getEdgePosition(startSquare, endSquare);
            if (isCircleOnArrow(circle.x, circle.y, arrowPoints)) {
              console.log(
                `Circle ${circle.id} is on the arrow at position: (${circle.x}, ${circle.y})`
              );
            }
          }
        }
      }
      //}
    });
  });

  //Function to snap Receiver to Grid
  const snapToGrid = (position: number, gridSize: number = 50) => {
    return Math.round(position / gridSize) * gridSize;
  };

  const getSidePointsAlongArrow = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    step: number = 50,
    offset: number = 30
  ) => {
    const points: { x: number; y: number }[] = [];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return points;

    // Unit direction vector
    const ux = dx / length;
    const uy = dy / length;

    // Perpendicular unit vector
    const perpX = -uy;
    const perpY = ux;

    const sideOffsets = [
      -offset,
      -2 * offset,
      -3 * offset,
      offset,
      2 * offset,
      3 * offset,
    ];

    for (let d = 0; d <= length; d += step) {
      const px = start.x + ux * d;
      const py = start.y + uy * d;

      // 3 circles on each side
      sideOffsets.forEach((side) => {
        points.push({ x: px + perpX * side, y: py + perpY * side });
      });
    }
    return points;
  };

useEffect(() => {
  // Array of { pair: string, dots: {x, y}[] }
  const allDotGroups: { pair: string; dots: { x: number; y: number }[] }[] = [];
  squares.forEach((startSquare) => {
    squares.forEach((endSquare) => {
      if (startSquare.id < endSquare.id) {
        const [startX, startY, endX, endY] = getEdgePosition(
          startSquare,
          endSquare
        );
        const points = getSidePointsAlongArrow(
          { x: startX, y: startY },
          { x: endX, y: endY },
          50,
          30
        );
        allDotGroups.push({
          pair: `${startSquare.id} ↔ ${endSquare.id}`,
          dots: points,
        });
      }
    });
  });
  setDotGroups(allDotGroups);
}, [squares]);

  return (
    <div style={{ position: "relative" }}>
      {/* Overlay for dot coordinates */}
<div
  style={{
    position: "absolute",
    top: 10,
    right: 10,
    background: "rgba(255,255,255,0.95)",
    border: "1px solid #ccc",
    borderRadius: 6,
    padding: "10px 16px",
    fontSize: 13,
    maxHeight: 400,
    overflowY: "auto",
    zIndex: 10,
    minWidth: 220,
  }}
>
  <b>Dots by Pair</b>
  {dotGroups.map((group, idx) => (
    <div key={group.pair} style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: "bold", color: "#333" }}>{group.pair}</div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {group.dots.map((dot, i) => (
          <li key={i}>
            x: {dot.x.toFixed(1)}, y: {dot.y.toFixed(1)}
          </li>
        ))}
      </ul>
    </div>
  ))}
</div>
      <Stage
        width={window.innerWidth}
        height={window.innerHeight}
        style={{ border: "1px solid lightgray" }}
      >
        <Layer>
          {Array.from({ length: Math.ceil(window.innerWidth / 50) }).map(
            (_, i) => (
              <Line
                key={`v-${i}`}
                points={[i * 50, 0, i * 50, window.innerHeight]}
                stroke="#ddd"
                strokeWidth={1}
              />
            )
          )}
          {Array.from({ length: Math.ceil(window.innerHeight / 50) }).map(
            (_, i) => (
              <Line
                key={`h-${i}`}
                points={[0, i * 50, window.innerWidth, i * 50]}
                stroke="#ddd"
                strokeWidth={1}
              />
            )
          )}
          {squares.map((square) => (
            <Rect
              key={square.id}
              x={square.x}
              y={square.y}
              width={Initial_Size}
              height={Initial_Size}
              fill={square.color}
              stroke="black"
              strokeWidth={2}
              draggable
              onDragMove={(e) => handleSquareDragMove(e, square.id)}
              onDragEnd={(e) => handleDragEnd(e, square.id)}
            />
          ))}
          {squares.map((startSquare) =>
            squares.map((endSquare) => {
              // Only draw one arrow per unique pair
              if (startSquare.id < endSquare.id) {
                const [startX, startY, endX, endY] = getEdgePosition(
                  startSquare,
                  endSquare
                );
                return (
                  <React.Fragment key={`${startSquare.id}-${endSquare.id}`}>
                    <Arrow
                      points={[startX, startY, endX, endY]}
                      stroke="black"
                      fill="black"
                      strokeWidth={5}
                      pointerWidth={15}
                      pointerLength={15}
                    />
                    {getSidePointsAlongArrow(
                      { x: startX, y: startY },
                      { x: endX, y: endY },
                      50,
                      30
                    ).map((pt, idx) => (
                      <KonvaCircle
                        key={`side-${startSquare.id}-${endSquare.id}-${idx}`}
                        x={pt.x}
                        y={pt.y}
                        radius={4}
                        fill="red"
                        opacity={0.7}
                        listening={false}
                      />
                    ))}
                  </React.Fragment>
                );
              }
              return null;
            })
          )}
          {circles.map((circle) => (
            <KonvaCircle
              key={circle.id}
              x={circle.x}
              y={circle.y}
              radius={Initial_Size / 2}
              fill={circle.color}
              stroke="black"
              strokeWidth={2}
              draggable
              onDragMove={(e) => handleCircleDragMove(e, circle.id)}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
};

export default Squares;
