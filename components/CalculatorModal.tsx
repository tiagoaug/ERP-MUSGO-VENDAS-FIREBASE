import React, { useState, useEffect } from 'react';
import { X, Check } from '@phosphor-icons/react';

interface CalculatorModalProps {
  isOpen: boolean;
  initialValue: number;
  onApply: (value: number) => void;
  onClose: () => void;
}

export const CalculatorModal = ({ isOpen, initialValue, onApply, onClose }: CalculatorModalProps) => {
  const [display, setDisplay] = useState(String(initialValue) || '0');
  const [isNewInput, setIsNewInput] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setDisplay(String(initialValue) || '0');
      setIsNewInput(true);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleInput = (char: string) => {
    if (display === 'Error' || (isNewInput && char !== '.')) {
      setDisplay(char);
      setIsNewInput(false);
    } else {
      setDisplay(display + char);
    }
  };

  const handleOperator = (op: string) => {
    if (['+', '-', '*', '/'].some(op => display.endsWith(` ${op} `))) {
      setDisplay(display.slice(0, -3) + ` ${op} `);
    } else {
      setDisplay(display + ` ${op} `);
    }
    setIsNewInput(false);
  };

  const calculate = () => {
    try {
      const sanitized = display.replace(/[^0-9.*/+-.]/g, '');
      const result = new Function('return ' + sanitized)();
      setDisplay(String(result));
    } catch (e) {
      setDisplay('Error');
    } finally {
      setIsNewInput(true);
    }
  };

  const handleApply = () => {
    const finalValue = parseFloat(display);
    if (!isNaN(finalValue)) {
      onApply(finalValue);
    }
    onClose();
  };

  const buttons = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+'];

  const handleButtonClick = (btn: string) => {
    if (btn === '=') {
      calculate();
    } else if (['+', '-', '*', '/'].includes(btn)) {
      handleOperator(btn);
    } else {
      handleInput(btn);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-[240px] rounded-2xl shadow-2xl flex flex-col animate-slideUp" onClick={e => e.stopPropagation()}>
        <div className="p-3 text-right bg-slate-100 dark:bg-slate-900 rounded-t-2xl font-mono text-2xl dark:text-white truncate h-16 flex items-center justify-end">{display}</div>
        <div className="grid grid-cols-4 gap-1 p-2">
          {buttons.map(btn => (
            <button key={btn} onClick={() => handleButtonClick(btn)} className="h-12 text-lg font-bold rounded-lg transition-colors bg-slate-50 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-slate-800 dark:text-slate-100">
              {btn}
            </button>
          ))}
        </div>
        <div className="flex gap-2 p-2 border-t dark:border-slate-700">
          <button onClick={() => { setDisplay('0'); setIsNewInput(true); }} className="flex-1 py-3 text-sm font-black uppercase rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-900/20">Limpar</button>
          <button onClick={handleApply} className="flex-1 py-3 text-sm font-black uppercase rounded-lg bg-emerald-500 text-white">Aplicar</button>
        </div>
      </div>
    </div>
  );
};