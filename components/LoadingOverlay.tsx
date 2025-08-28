import React from 'react';

interface LoadingOverlayProps {
  messages: string[];
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ messages }) => {
    const [message, setMessage] = React.useState(messages[0]);

    React.useEffect(() => {
        setMessage(messages[Math.floor(Math.random() * messages.length)]);

        const intervalId = setInterval(() => {
            setMessage(messages[Math.floor(Math.random() * messages.length)]);
        }, 2000);
        return () => clearInterval(intervalId);
    }, [messages]);

  return (
    <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
      <div className="w-16 h-16 border-4 border-t-4 border-gray-400 dark:border-zinc-600 border-t-indigo-500 rounded-full animate-spin"></div>
      <p className="mt-4 text-lg text-gray-300 font-serif">{message}</p>
    </div>
  );
};

export default LoadingOverlay;