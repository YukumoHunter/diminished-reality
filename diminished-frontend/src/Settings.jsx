import React from 'react';
import './Settings.css';

export default function SettingsPanel({ isOpen, onClose,
                                        diminishMethod, setDiminishMethod,
                                        diminishEffect, setDiminishEffect,
                                        nutriScoreBaseline, setNutriScoreBaseline,
                                        useOutline, setUseOutline,
                                        outlineColor, setOutlineColor
                                        }) {
  return (
    <div className={`settings-panel ${isOpen ? 'open' : ''}`}>
        <div className="settings-header">
            <h1>Settings</h1>
            <button onClick={onClose} className="close-button">×</button>
        </div>
        <div className="settings-content">
            {/* ---------------- Diminish Method ------------------- */}
            <div className="setting-option">
            <label className="setting-label">Diminish method: </label>
            
            <select
                className="setting-select"
                value={diminishMethod} 
                onChange={(e) => setDiminishMethod(Number(e.target.value))}
            >
                <option value={0}>Threshold</option>
                <option value={1}>Dynamic</option>
            </select>
            </div>

            {/* ---------------- Diminish Type ------------------- */}
            <div className="setting-option">
            <label className="setting-label">Diminish effect: </label>
            <select
                className="setting-select"
                value={diminishEffect} 
                onChange={(e) => setDiminishEffect(Number(e.target.value))}
            >
                <option value={0}>None</option>
                <option value={1}>Blur</option>
                <option value={2}>Overlay</option>
                <option value={3}>Desaturate</option>
            </select>
            </div>

            {/* ---------------- Nutri-score baseline ------------------- */}
            <div className="setting-option">
            <label className="setting-label">*Nutri-score baseline: </label>
            <select
                className="setting-select"
                value={nutriScoreBaseline} 
                onChange={(e) => setNutriScoreBaseline(Number(e.target.value))}
            >
                <option value={0}>A</option>
                <option value={1}>B</option>
                <option value={2}>C</option>
                <option value={3}>D</option>
                <option value={4}>E</option>
            </select>
            </div>

            {/* ---------------- Apply outline ------------------- */}
            <div className="setting-option">
            <label className="setting-label">Outline: </label>
            <select
                className="setting-select"
                value={useOutline}
                onChange={(e) => setUseOutline(Number(e.target.value))}
            >
                <option value={0}>Off</option>
                <option value={1}>Healthy products</option>
                <option value={2}>All products</option>
            </select>
            </div>

            {/* ---------------- Nutri-score baseline ------------------- */}
            <div className="setting-option">
            <label className="setting-label">**Outline color: </label>
            <select
                className="setting-select"
                value={outlineColor} 
                onChange={(e) => setOutlineColor(e.target.value)}
            >
                <option value={'nutri-score_based'}>Nutri-score based</option>
                <option value={'gray'}>Gray</option>
                <option value={'green'}>Green</option>
                <option value={'red'}>Red</option>
            </select>
            </div>
        </div>
        <div className="settings-footer">
            <p>*Only used with Threshold diminsh method</p>
            <p>**Only used with Outline on</p>
        </div>
    </div>
  );
}
