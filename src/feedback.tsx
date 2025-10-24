import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Hourglass } from 'lucide-react';
import './index.css';
import TranscriptionStatus from './components/TranscriptionStatus';

type Status = 'idle' | 'recording' | 'processing' | 'success' | 'error' | 'warning';

const AudioWave: React.FC = () => {
    return (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-1">
            {[...Array(5)].map((_, i) => (
                <div
                    key={i}
                    className="w-1 h-4 bg-blue-500 rounded-full animate-wave"
                    style={{
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: '1s'
                    }}
                />
            ))}
        </div>
    );
};

const FeedbackComponent: React.FC = () => {
    const [status, setStatus] = useState<Status>('idle');
    const [showMaxedOutMessage, setShowMaxedOutMessage] = useState(false);
    const [remainingTime, setRemainingTime] = useState<number | null>(null);

    useEffect(() => {
        const handleStatusChange = (newStatus: Status) => {
            setStatus(newStatus);
            // Reset countdown when status changes away from warning
            if (newStatus !== 'warning') {
                setRemainingTime(null);
            }
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

        const handleCountdownUpdate = (time: number) => {
            setRemainingTime(time);
        };

        window.electron.onRecordingStatus(handleStatusChange);
        window.electron.onTranscriptionResult(handleTranscriptionResult);
        // @ts-ignore
        window.electron.onCountdownUpdate(handleCountdownUpdate);

        // Signal that the component is ready, but wait for the next paint cycle
        // to ensure all styles are applied, preventing the white flash.
        requestAnimationFrame(() => {
            // @ts-ignore
            window.electron.sendFeedbackReady();
        });

        return () => {
            window.electron.removeRecordingStatusListener(handleStatusChange);
            window.electron.removeTranscriptionResultListener(handleTranscriptionResult);
            // @ts-ignore
            window.electron.removeCountdownUpdateListener(handleCountdownUpdate);
        };
    }, []);

    return (
        <div key={status}>
            {showMaxedOutMessage && (
                <div className="w-full h-full flex justify-center items-center animate-fade-in-out">
                    <div className="inline-flex items-center p-2 bg-gray-900 bg-opacity-75 rounded-lg text-white font-sans backdrop-blur-sm">
                        <span className="text-sm">一次可录最长60秒的语音</span>
                    </div>
                </div>
            )}

            {status === 'warning' && (
                <div className="w-full h-full flex justify-center items-center">
                    <div className="inline-flex items-center p-2 bg-gray-900 bg-opacity-75 rounded-lg text-white font-sans backdrop-blur-sm">
                        <Hourglass className="w-4 h-4 mr-2 animate-pulse text-yellow-400" />
                        <span className="text-sm">
                            已接近录音时限
                            {remainingTime !== null && (
                                <span className="ml-2 font-bold text-yellow-300">
                                    {remainingTime}s
                                </span>
                            )}
                        </span>
                    </div>
                </div>
            )}

            {status === 'recording' && <AudioWave />}
            {status === 'processing' && <TranscriptionStatus />}
        </div>
    );
};

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<FeedbackComponent />);
} 