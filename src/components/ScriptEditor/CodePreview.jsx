import { useState, useEffect } from 'react';

function CodePreview({ code }) {
    const [copied, setCopied] = useState(false);
    const [lineNumbers, setLineNumbers] = useState([]);

    useEffect(() => {
        const lines = code.split('\n');
        setLineNumbers(lines.map((_, i) => i + 1));
    }, [code]);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'script.lua';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="code-preview">
            <div className="code-preview-header">
                <span className="code-preview-title">📜 Lua Code Preview</span>
                <div className="code-preview-actions">
                    <button
                        className="code-preview-btn"
                        onClick={handleCopy}
                        title="Copy to clipboard"
                    >
                        {copied ? '✅ Copied!' : '📋 Copy'}
                    </button>
                    <button
                        className="code-preview-btn"
                        onClick={handleDownload}
                        title="Download .lua file"
                    >
                        💾 Download
                    </button>
                </div>
            </div>

            <div className="code-preview-content">
                <div className="code-line-numbers">
                    {lineNumbers.map(num => (
                        <div key={num} className="line-number">{num}</div>
                    ))}
                </div>
                <pre className="code-text">
                    <code>{code}</code>
                </pre>
            </div>

            <div className="code-preview-footer">
                <span>{lineNumbers.length} lines</span>
                <span>•</span>
                <span>{code.length} characters</span>
            </div>
        </div>
    );
}

export default CodePreview;
