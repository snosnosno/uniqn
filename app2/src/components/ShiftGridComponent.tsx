import React from 'react';
import LightweightDataGrid from './LightweightDataGrid';
import { ValidationResult } from '../utils/shiftValidation';

interface ShiftGridComponentProps {
  dealers: Array<{
    id: string;
    staffName: string;
    startTime: string;
    assignments: { [timeSlot: string]: string };
  }>;
  timeSlots: string[];
  tables: Array<{
    id: string;
    name: string;
    tableNumber: number;
    status?: 'open' | 'closed' | 'standby';
  }>;
  onCellChange: (staffId: string, timeSlot: string, value: string) => void;
  validationResult?: ValidationResult | null;
  readonly?: boolean;
  height?: number;
}

const ShiftGridComponent: React.FC<ShiftGridComponentProps> = (props) => {
  // LightweightDataGrid를 직접 반환
  return <LightweightDataGrid {...props} />;
};

export default ShiftGridComponent;