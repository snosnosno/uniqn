import React from 'react';

interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

interface SimpleBarChartProps {
  data: BarChartData[];
  height?: number;
  showValues?: boolean;
  unit?: string;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = React.memo(({ 
  data, 
  height = 200,
  showValues = true,
  unit = ''
}) => {
  const maxValue = Math.max(...data.map(d => d.value));
  
  return (
    <div className="w-full" style={{ height }}>
      <div className="flex items-end justify-between h-full space-x-2">
        {data.map((item, index) => {
          const barHeight = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
          return (
            <div key={index} className="flex-1 flex flex-col items-center justify-end h-full">
              {showValues && (
                <div className="text-sm font-semibold text-gray-700 mb-1">
                  {item.value}{unit}
                </div>
              )}
              <div 
                className={`w-full rounded-t-lg transition-all duration-500 ${item.color || 'bg-blue-500'}`}
                style={{ height: `${barHeight}%` }}
              />
              <div className="text-xs text-gray-600 mt-2 text-center">
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

interface PieChartData {
  label: string;
  value: number;
  color: string;
}

interface SimplePieChartProps {
  data: PieChartData[];
  size?: number;
  donut?: boolean;
}

export const SimplePieChart: React.FC<SimplePieChartProps> = React.memo(({ 
  data, 
  size = 200,
  donut = false
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cumulativeAngle = -90; // Start from top
  
  const radius = size / 2;
  const centerX = radius;
  const centerY = radius;
  const donutWidth = donut ? radius * 0.6 : 0;
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform">
        {data.map((item, index) => {
          const percentage = (item.value / total) * 100;
          const angle = (percentage / 100) * 360;
          const startAngle = cumulativeAngle;
          const endAngle = cumulativeAngle + angle;
          
          const startAngleRad = (startAngle * Math.PI) / 180;
          const endAngleRad = (endAngle * Math.PI) / 180;
          
          const x1 = centerX + (radius - 1) * Math.cos(startAngleRad);
          const y1 = centerY + (radius - 1) * Math.sin(startAngleRad);
          const x2 = centerX + (radius - 1) * Math.cos(endAngleRad);
          const y2 = centerY + (radius - 1) * Math.sin(endAngleRad);
          
          const largeArcFlag = angle > 180 ? 1 : 0;
          
          let path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius - 1} ${radius - 1} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
          
          if (donut) {
            const innerRadius = donutWidth;
            const ix1 = centerX + innerRadius * Math.cos(startAngleRad);
            const iy1 = centerY + innerRadius * Math.sin(startAngleRad);
            const ix2 = centerX + innerRadius * Math.cos(endAngleRad);
            const iy2 = centerY + innerRadius * Math.sin(endAngleRad);
            
            path = `M ${x1} ${y1} A ${radius - 1} ${radius - 1} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix1} ${iy1} Z`;
          }
          
          cumulativeAngle = endAngle;
          
          return (
            <path
              key={index}
              d={path}
              fill={item.color}
              className="hover:opacity-80 transition-opacity cursor-pointer"
            />
          );
        })}
      </svg>
      
      {/* Legend */}
      <div className="absolute top-0 right-0 -mr-32 text-sm">
        {data.map((item, index) => (
          <div key={index} className="flex items-center space-x-2 mb-1">
            <div 
              className="w-3 h-3 rounded-sm" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-600">{item.label}</span>
            <span className="text-gray-800 font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

interface LineChartPoint {
  x: number;
  y: number;
  label?: string;
}

interface SimpleLineChartProps {
  data: LineChartPoint[];
  width?: number;
  height?: number;
  color?: string;
  showGrid?: boolean;
}

export const SimpleLineChart: React.FC<SimpleLineChartProps> = React.memo(({
  data,
  width = 300,
  height = 150,
  color = '#3B82F6',
  showGrid = true
}) => {
  if (data.length === 0) return null;
  
  const padding = 20;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;
  
  const xMin = Math.min(...data.map(d => d.x));
  const xMax = Math.max(...data.map(d => d.x));
  const yMin = Math.min(...data.map(d => d.y));
  const yMax = Math.max(...data.map(d => d.y));
  
  const xScale = (x: number) => ((x - xMin) / (xMax - xMin)) * chartWidth + padding;
  const yScale = (y: number) => height - (((y - yMin) / (yMax - yMin)) * chartHeight + padding);
  
  const pathData = data
    .map((point, index) => {
      const x = xScale(point.x);
      const y = yScale(point.y);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
  
  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Grid */}
      {showGrid && (
        <>
          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding + (1 - ratio) * chartHeight;
            return (
              <line
                key={`h-${ratio}`}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
            );
          })}
        </>
      )}
      
      {/* Line */}
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth="2"
        className="transition-all duration-300"
      />
      
      {/* Points */}
      {data.map((point, index) => (
        <circle
          key={index}
          cx={xScale(point.x)}
          cy={yScale(point.y)}
          r="4"
          fill={color}
          className="hover:r-6 transition-all duration-200"
        >
          <title>{point.label || `${point.x}, ${point.y}`}</title>
        </circle>
      ))}
    </svg>
  );
});