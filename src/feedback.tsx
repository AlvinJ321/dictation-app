import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Hourglass } from 'lucide-react';
import './index.css';

type Status = 'idle' | 'recording' | 'processing' | 'success' | 'error' | 'warning';

const FeedbackComponent: React.FC = () => {
    const [status, setStatus] = useState<Status>('idle');
    const [showMaxedOutMessage, setShowMaxedOutMessage] = useState(false);

    useEffect(() => {
        const handleStatusChange = (newStatus: Status) => {
            setStatus(newStatus);
        };

        const handleTranscriptionResult = (result: { success: boolean; maxedOut?: boolean }) => {
            if (result.success && result.maxedOut) {
                setStatus('idle');
                setShowMaxedOutMessage(true);
                setTimeout(() => {
                    setShowMaxedOutMessage(false);
                }, 6000);
            }
        };

        window.electron.onRecordingStatus(handleStatusChange);
        window.electron.onTranscriptionResult(handleTranscriptionResult);

        return () => {
            window.electron.removeRecordingStatusListener(handleStatusChange);
            window.electron.removeTranscriptionResultListener(handleTranscriptionResult);
        };
    }, []);

    const renderContent = () => {
        if (showMaxedOutMessage) {
            return (
                <div className="w-full h-full flex justify-center items-center animate-fade-in-out">
                    <div className="inline-flex items-center p-2 bg-gray-900 bg-opacity-75 rounded-lg text-white font-sans backdrop-blur-sm">
                        <span className="text-sm">一次最大录音时长为60秒</span>
                    </div>
                </div>
            );
        }

        if (status === 'warning') {
            return (
                <div className="w-full h-full flex justify-center items-center">
                    <div className="inline-flex items-center p-2 bg-gray-900 bg-opacity-75 rounded-lg text-white font-sans backdrop-blur-sm">
                        <Hourglass className="w-4 h-4 mr-2 animate-pulse text-yellow-400" />
                        <span className="text-sm">已接近录音时限</span>
                    </div>
                </div>
            );
        }

        return null;
    };

    return renderContent();
};

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<FeedbackComponent />);
} 