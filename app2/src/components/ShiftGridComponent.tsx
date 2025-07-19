import React, { useMemo, useCallback } from 'react';
import DataGrid, { Column } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { FaTable, FaCoffee, FaClock, FaUser, FaExclamationTriangle, FaCheckCircle, FaInfoCircle } from 'react-icons/fa';

import { ValidationResult, ValidationViolation } from '../utils/shiftValidation';

interface GridRow {
  id: string;
  dealerName: string;
  startTime: string;
  [timeSlot: string]: string;
}

interface ShiftGridComponentProps {
  dealers: Array<{
    id: string;
    dealerName: string;
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
  onCellChange: (dealerId: string, timeSlot: string, value: string) => void;
  validationResult?: ValidationResult | null;
  readonly?: boolean;
  height?: number;
}

// 검증 결과에 따른 셀 스타일 결정
const getCellStyle = (
  value: string, 
  dealerId: string, 
  timeSlot: string, 
  validationResult?: ValidationResult | null
): string => {
  let baseStyle = '';
  
  // 기본 스타일
  if (!value || value === '대기') baseStyle = 'bg-gray-100 text-gray-500';
  else if (value === '휴식') baseStyle = 'bg-orange-100 text-orange-700';
  else if (value.startsWith('T')) baseStyle = 'bg-blue-100 text-blue-700 font-medium';
  else baseStyle = 'bg-green-100 text-green-700';
  
  // 검증 오류가 있는 경우 경고 스타일 추가
  if (validationResult?.violations) {
    const hasError = validationResult.violations.some(
      violation => violation.dealerId === dealerId && 
                  violation.timeSlot === timeSlot && 
                  violation.severity === 'error'
    );
    const hasWarning = validationResult.violations.some(
      violation => violation.dealerId === dealerId && 
                  violation.timeSlot === timeSlot && 
                  violation.severity === 'warning'
    );
    
    if (hasError) {
      baseStyle += ' border-2 border-red-500 ring-1 ring-red-300';
    } else if (hasWarning) {
      baseStyle += ' border border-yellow-500 ring-1 ring-yellow-200';
    }
  }
  
  return baseStyle;
};

const getCellIcon = (value: string) => {
  if (!value || value === '대기') return <FaClock className="w-3 h-3" />;
  if (value === '휴식') return <FaCoffee className="w-3 h-3" />;
  if (value.startsWith('T')) return <FaTable className="w-3 h-3" />;
  return <FaUser className="w-3 h-3" />;
};

// 검증 위반 사항 툴팁 컴포넌트
const ValidationTooltip: React.FC<{
  violations: ValidationViolation[];
  dealerId: string;
  timeSlot: string;
}> = ({ violations, dealerId, timeSlot }) => {
  const relevantViolations = violations.filter(
    v => v.dealerId === dealerId && v.timeSlot === timeSlot
  );

  if (relevantViolations.length === 0) return null;

  return (
    <div className="absolute z-10 bg-white border rounded shadow-lg p-2 text-xs w-64 top-full left-0 mt-1">
      {relevantViolations.map((violation, index) => (
        <div key={index} className="mb-1 last:mb-0">
          <div className={`flex items-center gap-1 ${
            violation.severity === 'error' ? 'text-red-600' : 
            violation.severity === 'warning' ? 'text-yellow-600' : 
            'text-blue-600'
          }`}>
            {violation.severity === 'error' ? <FaExclamationTriangle className="w-3 h-3" /> :
             violation.severity === 'warning' ? <FaInfoCircle className="w-3 h-3" /> :
             <FaCheckCircle className="w-3 h-3" />}
            <span className="font-medium">{violation.message}</span>
          </div>
          {violation.suggestedFix ? <div className="text-gray-600 ml-4 mt-1">
              제안: {violation.suggestedFix}
            </div> : null}
        </div>
      ))}
    </div>
  );
};

const CellEditor: React.FC<{
  row: GridRow;
  column: Column<GridRow>;
  onRowChange: (row: GridRow, commitChanges?: boolean) => void;
  onClose: (commitChanges?: boolean) => void;
  tables: Array<{ id: string; name: string; tableNumber: number; status?: string }>;
}> = ({ row, column, onRowChange, onClose, tables }) => {
  const [value, setValue] = React.useState(row[column.key as keyof GridRow] as string || '');

  const availableOptions = React.useMemo(() => {
    const options = [
      { value: '', label: '대기' },
      { value: '휴식', label: '휴식' },
    ];
    
    const activeTables = tables.filter(t => t.status === 'open');
    activeTables.forEach(table => {
      options.push({
        value: `T${table.tableNumber}`,
        label: `${table.name} (T${table.tableNumber})`
      });
    });
    
    return options;
  }, [tables]);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = event.target.value;
    setValue(newValue);
    onRowChange({ ...row, [column.key]: newValue }, true);
    onClose(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose(false);
    }
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className="w-full h-full px-1 border-none outline-none bg-white text-sm"
      autoFocus
    >
      {availableOptions.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

const CellRenderer: React.FC<{
  row: GridRow;
  column: Column<GridRow>;
  validationResult?: ValidationResult | null;
}> = ({ row, column, validationResult }) => {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const value = row[column.key as keyof GridRow] as string || '';
  const icon = getCellIcon(value);
  const style = getCellStyle(value, row.id, column.key as string, validationResult);
  
  const hasViolations = validationResult?.violations?.some(
    v => v.dealerId === row.id && v.timeSlot === column.key
  ) || false;

  return (
    <div 
      className={`relative h-full flex items-center justify-center gap-2 px-2 py-1 ${style}`}
      onMouseEnter={() => hasViolations && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {icon}
      <span className="text-sm font-medium">
        {value || '대기'}
      </span>
      {hasViolations ? <FaExclamationTriangle className="w-3 h-3 text-red-500 ml-1" /> : null}
      {showTooltip && hasViolations && validationResult?.violations ? <ValidationTooltip 
          violations={validationResult.violations}
          dealerId={row.id}
          timeSlot={column.key as string}
        /> : null}
    </div>
  );
};

// 검증 요약 컴포넌트
const ValidationSummary: React.FC<{
  validationResult: ValidationResult;
}> = ({ validationResult }) => {
  const errorCount = validationResult.violations.filter(v => v.severity === 'error').length;
  const warningCount = validationResult.violations.filter(v => v.severity === 'warning').length;
  const infoCount = validationResult.violations.filter(v => v.severity === 'info').length;

  if (validationResult.isValid && validationResult.violations.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md text-green-700">
        <FaCheckCircle className="w-4 h-4" />
        <span className="text-sm font-medium">모든 교대 규칙을 준수합니다</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {errorCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-red-700">
          <FaExclamationTriangle className="w-4 h-4" />
          <span className="text-sm font-medium">{errorCount}개의 오류가 있습니다</span>
        </div>
      )}
      {warningCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-700">
          <FaInfoCircle className="w-4 h-4" />
          <span className="text-sm font-medium">{warningCount}개의 경고가 있습니다</span>
        </div>
      )}
      {infoCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-blue-700">
          <FaInfoCircle className="w-4 h-4" />
          <span className="text-sm font-medium">{infoCount}개의 정보가 있습니다</span>
        </div>
      )}
      {validationResult.suggestions.length > 0 && (
        <div className="text-sm text-gray-600">
          <div className="font-medium mb-1">제안사항:</div>
          <ul className="list-disc list-inside space-y-1">
            {validationResult.suggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const ShiftGridComponent: React.FC<ShiftGridComponentProps> = ({
  dealers,
  tables,
  timeSlots,
  onCellChange,
  validationResult,
  readonly = false,
  height = 400,
}) => {
  const columns = useMemo<Column<GridRow>[]>(() => {
    const baseColumns: Column<GridRow>[] = [
      {
        key: 'dealerName',
        name: '딜러명',
        width: 120,
        frozen: true,
        resizable: false,
        sortable: false,
        renderCell: ({ row }) => (
          <div className="flex items-center gap-2 px-2 py-1">
            <FaUser className="w-3 h-3 text-gray-600" />
            <div>
              <div className="text-sm font-medium text-gray-800">{row.dealerName}</div>
              <div className="text-xs text-gray-500">출근: {row.startTime}</div>
            </div>
          </div>
        ),
      },
    ];
    
    const timeColumns: Column<GridRow>[] = timeSlots.map(timeSlot => ({
      key: timeSlot,
      name: timeSlot,
      width: 100,
      resizable: true,
      sortable: false,
      editable: !readonly,
      renderCell: (props) => <CellRenderer {...props} validationResult={validationResult || null} />,
      renderEditCell: readonly ? undefined : (props) => <CellEditor {...props} tables={tables} />,
    }));
    
    return [...baseColumns, ...timeColumns];
  }, [timeSlots, readonly, tables, validationResult]);
  
  const rows = useMemo<GridRow[]>(() => {
    return dealers.map(dealer => {
      const row: GridRow = {
        id: dealer.id,
        dealerName: dealer.dealerName,
        startTime: dealer.startTime,
      };
      
      timeSlots.forEach(timeSlot => {
        row[timeSlot] = dealer.assignments[timeSlot] || '';
      });
      
      return row;
    });
  }, [dealers, timeSlots]);
  
  const handleRowsChange = useCallback((updatedRows: GridRow[]) => {
    updatedRows.forEach((updatedRow, index) => {
      const originalRow = rows[index];
      if (originalRow) {
        timeSlots.forEach(timeSlot => {
          const oldValue = originalRow[timeSlot] as string;
          const newValue = updatedRow[timeSlot] as string;
          
          if (oldValue !== newValue) {
            onCellChange(updatedRow.id, timeSlot, newValue);
          }
        });
      }
    });
  }, [rows, timeSlots, onCellChange]);
  
  return (
    <div className="space-y-4">
      {/* 검증 결과 요약 */}
      {validationResult ? <ValidationSummary validationResult={validationResult} /> : null}
      
      {/* 데이터 그리드 */}
      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
        <DataGrid
          columns={columns}
          rows={rows}
          onRowsChange={handleRowsChange}
          className="react-data-grid"
          style={{ height: `${height}px` }}
          headerRowHeight={40}
          rowHeight={60}
          enableVirtualization
          renderers={{
            noRowsFallback: (
              <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                <FaTable className="w-8 h-8 mb-2" />
                <p className="text-sm">등록된 딜러가 없습니다</p>
              </div>
            ),
          }}
        />
      </div>
    </div>
  );
};

export default ShiftGridComponent;