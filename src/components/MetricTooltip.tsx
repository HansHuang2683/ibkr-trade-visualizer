import React, { useState, useRef, useEffect } from 'react';

interface Props {
    children: React.ReactNode;
    title: string;
    description: string;
    metrics: {
        label: string;
        value: string;
        color: 'green' | 'yellow' | 'red';
    }[];
}

const MetricTooltip: React.FC<Props> = ({ children, title, description, metrics }) => {
    const [isVisible, setIsVisible] = useState(false);
    const timeoutRef = useRef<number | null>(null);

    const handleMouseEnter = () => {
        timeoutRef.current = window.setTimeout(() => {
            setIsVisible(true);
        }, 1000); // 1-second delay
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsVisible(false);
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return (
        <div
            className="tooltip-container"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {children}
            {isVisible && (
                <div className="tooltip-content">
                    <h4>{title}</h4>
                    <p className="tooltip-desc">{description}</p>
                    {metrics.length > 0 && (
                        <div className="tooltip-tiers">
                            {metrics.map((m, idx) => (
                                <div className="tier" key={idx}>
                                    <span className={`tier-dot ${m.color}`}></span>
                                    <span className="tier-label">{m.label}:</span>
                                    <span className="tier-val">{m.value}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MetricTooltip;
