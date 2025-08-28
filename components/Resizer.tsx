import React from 'react';

const Resizer: React.FC<{ onMouseDown: (e: React.MouseEvent) => void, isHorizontal: boolean }> = ({ onMouseDown, isHorizontal }) => {
    const orientationClasses = isHorizontal
        ? "cursor-col-resize w-2 h-full"
        : "cursor-row-resize h-2 w-full";
    return (
        <div
            onMouseDown={onMouseDown}
            className={`flex-shrink-0 bg-gray-300 dark:bg-zinc-800 hover:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors duration-200 ${orientationClasses}`}
        />
    );
};

export default Resizer;