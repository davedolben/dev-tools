import React, { useEffect, useState } from "react";

export const Prompt = () => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      width: '100%'
    }}>
      <div style={{
        position: 'relative',
        width: '80%',
        maxWidth: '600px',
        display: 'flex',
        alignItems: 'center'
      }}>
        <svg
          style={{
            position: 'absolute',
            left: '12px',
            width: '20px',
            height: '20px',
            color: '#666'
          }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="6.5" />
          <line x1="22" y1="22" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Enter your prompt..."
          style={{
            width: '100%',
            padding: '12px 20px 12px 40px',
            fontSize: '16px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            outline: 'none'
          }}
        />
      </div>
    </div>
  );
};

