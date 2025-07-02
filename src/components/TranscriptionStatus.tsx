import React from 'react';

const TranscriptionStatus: React.FC = () => {
    return (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2">
            <div className="loader"></div>
        </div>
    );
};

export default TranscriptionStatus; 