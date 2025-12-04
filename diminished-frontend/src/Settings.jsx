import React from 'react';
import { ALL_PRODUCTS, SCHIJF_VAN_VIJF_DEFAULTS } from './constants';
import './Settings.css';

export default function SettingsPanel({ isOpen, onClose,
                                        diminishEffect, setDiminishEffect,
                                        useOutline, setUseOutline,
                                        outlineColor, setOutlineColor,
                                        classOverrides, setClassOverrides
                                        }) {

  const handleClassToggle = (productName) => {
    const currentStatus = classOverrides[productName] !== undefined 
        ? classOverrides[productName] 
        : SCHIJF_VAN_VIJF_DEFAULTS[productName];
    
    setClassOverrides({
        ...classOverrides,
        [productName]: !currentStatus
    });
  };

  return (
    <div className={`settings-panel ${isOpen ? 'open' : ''}`}>
        <div className="settings-header">
            <h1>Settings</h1>
            <button onClick={onClose} className="close-button">×</button>
        </div>
        <div className="settings-content">
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

            {/* ---------------- Outline color ------------------- */}
            <div className="setting-option">
            <label className="setting-label">**Outline color: </label>
            <select
                className="setting-select"
                value={outlineColor} 
                onChange={(e) => setOutlineColor(e.target.value)}
            >
                <option value={'health_based'}>Health based</option>
                <option value={'gray'}>Gray</option>
                <option value={'green'}>Green</option>
                <option value={'red'}>Red</option>
            </select>
            </div>

            {/* ---------------- Product Settings ------------------- */}
            <div className="setting-section">
                <h3>Product Settings (Schijf van Vijf)</h3>
                <div className="product-list">
                    {ALL_PRODUCTS.map(product => {
                        const isHealthy = classOverrides[product] !== undefined 
                            ? classOverrides[product] 
                            : SCHIJF_VAN_VIJF_DEFAULTS[product];
                        
                        return (
                            <div key={product} className="product-item">
                                <label>
                                    <input 
                                        type="checkbox" 
                                        checked={isHealthy}
                                        onChange={() => handleClassToggle(product)}
                                    />
                                    {product}
                                </label>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
        <div className="settings-footer">
            <p>**Only used with Outline on</p>
        </div>
    </div>
  );
}
