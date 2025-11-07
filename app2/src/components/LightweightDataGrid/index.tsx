import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table';
import { ClockIcon, CoffeeIcon, TableIcon, UserIcon, ExclamationIcon, CheckCircleIcon, InformationCircleIcon } from '../Icons';
import { ValidationResult, ValidationViolation } from '../../utils/shiftValidation';

interface GridRow {
  id: string;
  staffName: string;
  startTime: string;
  [timeSlot: string]: string;
}

interface LightweightDataGridProps {
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

// 검증 결과에 따른 셀 스타일 결정
const getCellStyle = (
  value: string,
  staffId: string,
  timeSlot: string,
  validationResult?: ValidationResult | null
): string => {
  let baseStyle = '';
  
  // 기본 스타일
  if (!value || value === '대기') baseStyle = 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
  else if (value === '휴식') baseStyle = 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
  else if (value.startsWith('T')) baseStyle = 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium';
  else baseStyle = 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
  
  // 검증 오류가 있는 경우 경고 스타일 추가
  if (validationResult?.violations) {
    const hasError = validationResult.violations.some(
      violation => violation.staffId === staffId && 
                  violation.timeSlot === timeSlot && 
                  violation.severity === 'error'
    );
    const hasWarning = validationResult.violations.some(
      violation => violation.staffId === staffId && 
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
  if (!value || value === '대기') return <ClockIcon className="w-3 h-3" />;
  if (value === '휴식') return <CoffeeIcon className="w-3 h-3" />;
  if (value.startsWith('T')) return <TableIcon className="w-3 h-3" />;
  return <UserIcon className="w-3 h-3" />;
};

// 검증 위반 사항 툴팁 컴포넌트
const ValidationTooltip: React.FC<{
  violations: ValidationViolation[];
  staffId: string;
  timeSlot: string;
}> = ({ violations, staffId, timeSlot }) => {
  const relevantViolations = violations.filter(
    v => v.staffId === staffId && v.timeSlot === timeSlot
  );

  if (relevantViolations.length === 0) return null;

  return (
    <div className="absolute z-10 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-lg p-2 text-xs w-64 top-full left-0 mt-1">
      {relevantViolations.map((violation, index) => (
        <div key={index} className="mb-1 last:mb-0">
          <div className={`flex items-center gap-1 ${
            violation.severity === 'error' ? 'text-red-600 dark:text-red-400' :
            violation.severity === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
            'text-blue-600 dark:text-blue-400'
          }`}>
            {violation.severity === 'error' ? <ExclamationIcon className="w-3 h-3" /> :
             violation.severity === 'warning' ? <InformationCircleIcon className="w-3 h-3" /> :
             <CheckCircleIcon className="w-3 h-3" />}
            <span className="font-medium">{violation.message}</span>
          </div>
          {violation.suggestedFix && (
            <div className="text-gray-600 dark:text-gray-300 ml-4 mt-1">
              제안: {violation.suggestedFix}
            </div>
          )}
        </div>
      ))}
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
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-md text-green-700 dark:text-green-300">
        <CheckCircleIcon className="w-4 h-4" />
        <span className="text-sm font-medium">모든 교대 규칙을 준수합니다</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {errorCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-md text-red-700 dark:text-red-300">
          <ExclamationIcon className="w-4 h-4" />
          <span className="text-sm font-medium">{errorCount}개의 오류가 있습니다</span>
        </div>
      )}
      {warningCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-md text-yellow-700 dark:text-yellow-300">
          <InformationCircleIcon className="w-4 h-4" />
          <span className="text-sm font-medium">{warningCount}개의 경고가 있습니다</span>
        </div>
      )}
      {infoCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md text-blue-700 dark:text-blue-300">
          <InformationCircleIcon className="w-4 h-4" />
          <span className="text-sm font-medium">{infoCount}개의 정보가 있습니다</span>
        </div>
      )}
      {validationResult.suggestions.length > 0 && (
        <div className="text-sm text-gray-600 dark:text-gray-300">
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

// 테이블 셀 컴포넌트
const TableCell: React.FC<{
  value: string;
  rowId: string;
  timeSlot: string;
  icon: React.ReactNode;
  style: string;
  hasViolations: boolean;
  validationResult: ValidationResult | null | undefined;
  isEditing: boolean;
  _readonly: boolean | undefined;
  tables: any[];
  onCellClick: () => void;
  onCellChange: (staffId: string, timeSlot: string, value: string) => void;
  setEditingCell: (cell: { rowId: string; columnId: string } | null) => void;
}> = ({ 
  value, 
  rowId, 
  timeSlot, 
  icon, 
  style, 
  hasViolations, 
  validationResult, 
  isEditing, 
  _readonly,
  tables,
  onCellClick,
  onCellChange,
  setEditingCell 
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (isEditing) {
    return (
      <CellEditor
        value={value}
        onSave={(newValue) => {
          onCellChange(rowId, timeSlot, newValue);
          setEditingCell(null);
        }}
        onCancel={() => setEditingCell(null)}
        tables={tables}
      />
    );
  }

  return (
    <div 
      className={`relative h-full flex items-center justify-center gap-2 px-2 py-1 cursor-pointer ${style}`}
      onClick={onCellClick}
      onMouseEnter={() => hasViolations && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {icon}
      <span className="text-sm font-medium">
        {value || '대기'}
      </span>
      {hasViolations && <ExclamationIcon className="w-3 h-3 text-red-500 ml-1" />}
      {showTooltip && hasViolations && validationResult?.violations && (
        <ValidationTooltip 
          violations={validationResult.violations}
          staffId={rowId}
          timeSlot={timeSlot}
        />
      )}
    </div>
  );
};

// 셀 편집 컴포넌트
const CellEditor: React.FC<{
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  tables: Array<{ id: string; name: string; tableNumber: number; status?: string }>;
}> = ({ value: initialValue, onSave, onCancel, tables }) => {
  const [value, setValue] = useState(initialValue);

  const availableOptions = useMemo(() => {
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
    onSave(newValue);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className="w-full h-full px-1 border-none outline-none bg-white dark:bg-gray-700 dark:text-gray-100 text-sm"
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

const LightweightDataGrid: React.FC<LightweightDataGridProps> = ({
  dealers,
  tables,
  timeSlots,
  onCellChange,
  validationResult,
  readonly = false,
  height = 400,
}) => {
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null);

  // 데이터 변환
  const data = useMemo<GridRow[]>(() => {
    return dealers.map(dealer => {
      const row: GridRow = {
        id: dealer.id,
        staffName: dealer.staffName,
        startTime: dealer.startTime,
      };
      
      timeSlots.forEach(timeSlot => {
        row[timeSlot] = dealer.assignments[timeSlot] || '';
      });
      
      return row;
    });
  }, [dealers, timeSlots]);

  // 컬럼 정의
  const columns = useMemo<ColumnDef<GridRow>[]>(() => {
    const baseColumns: ColumnDef<GridRow>[] = [
      {
        id: 'staffName',
        accessorKey: 'staffName',
        header: '스태프',
        size: 120,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2 px-2 py-1">
            <UserIcon className="w-3 h-3 text-gray-600 dark:text-gray-300" />
            <div>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{row.original.staffName}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">출근: {row.original.startTime}</div>
            </div>
          </div>
        ),
      },
    ];
    
    const timeColumns: ColumnDef<GridRow>[] = timeSlots.map(timeSlot => ({
      id: timeSlot,
      accessorKey: timeSlot,
      header: timeSlot,
      size: 100,
      cell: ({ row, getValue }) => {
        const value = getValue() as string || '';
        const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === timeSlot;
        const icon = getCellIcon(value);
        const style = getCellStyle(value, row.id, timeSlot, validationResult);
        
        const hasViolations = validationResult?.violations?.some(
          v => v.staffId === row.id && v.timeSlot === timeSlot
        ) || false;

        const handleCellClick = () => {
          if (!readonly) {
            setEditingCell({ rowId: row.id, columnId: timeSlot });
          }
        };

        return (
          <TableCell
            value={value}
            rowId={row.id}
            timeSlot={timeSlot}
            icon={icon}
            style={style}
            hasViolations={hasViolations}
            validationResult={validationResult}
            isEditing={isEditing}
            _readonly={readonly}
            tables={tables}
            onCellClick={handleCellClick}
            onCellChange={onCellChange}
            setEditingCell={setEditingCell}
          />
        );
      },
    }));
    
    return [...baseColumns, ...timeColumns];
  }, [timeSlots, readonly, tables, validationResult, editingCell, onCellChange]);

  // 테이블 인스턴스
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
  });

  return (
    <div className="space-y-4">
      {/* 검증 결과 요약 */}
      {validationResult && <ValidationSummary validationResult={validationResult} />}
      
      {/* 데이터 그리드 */}
      <div
        className="border dark:border-gray-700 rounded-lg overflow-auto bg-white dark:bg-gray-800 shadow-sm"
        style={{ height: `${height}px` }}
      >
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-700">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-2 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-200 border-r dark:border-gray-700 last:border-r-0"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500 dark:hover:bg-blue-400"
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center">
                  <div className="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    <TableIcon className="w-8 h-8 mb-2" />
                    <p className="text-sm">등록된 딜러가 없습니다</p>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      className="border-r last:border-r-0 h-[60px]"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LightweightDataGrid;