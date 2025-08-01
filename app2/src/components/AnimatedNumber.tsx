import React, { useEffect, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = React.memo(({
  value,
  duration = 1000,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = ''
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (hasAnimated) {
      // 이미 애니메이션이 실행되었으면 바로 값 업데이트
      setDisplayValue(value);
      return;
    }

    const startTime = Date.now();
    const startValue = displayValue;
    const endValue = value;
    const totalChange = endValue - startValue;

    const animate = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out-cubic)
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
      const easedProgress = easeOutCubic(progress);

      const currentValue = startValue + totalChange * easedProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setHasAnimated(true);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration, displayValue, hasAnimated]);

  const formattedValue = displayValue.toFixed(decimals);
  const parts = formattedValue.split('.');
  const integerPart = parts[0] || '0';
  const decimalPart = parts[1];
  const formattedInteger = parseInt(integerPart).toLocaleString();
  const finalValue = decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;

  return (
    <span className={className}>
      {prefix}{finalValue}{suffix}
    </span>
  );
});