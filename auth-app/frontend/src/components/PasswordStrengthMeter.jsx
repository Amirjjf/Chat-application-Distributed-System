import React, { useState, useEffect } from 'react';

// Password strength criteria
const checkStrength = (password) => {
  let score = 0;
  
  // No password
  if (!password) return { score: 0, feedback: 'Password required' };
  
  // Length check
  if (password.length > 8) score += 1;
  if (password.length > 12) score += 1;

  // Character variety checks
  if (/[A-Z]/.test(password)) score += 1; // Has uppercase
  if (/[a-z]/.test(password)) score += 1; // Has lowercase
  if (/[0-9]/.test(password)) score += 1; // Has number
  if (/[^A-Za-z0-9]/.test(password)) score += 1; // Has special char
  
  // Common patterns check (decrease score if found)
  if (/123|abc|qwerty|password|admin|welcome/i.test(password)) score = Math.max(0, score - 2);
  
  // Sequential characters check
  const hasSequential = (pass, minLength = 3) => {
    for (let i = 0; i < pass.length - minLength + 1; i++) {
      const charCode = pass.charCodeAt(i);
      let sequential = true;
      
      for (let j = 1; j < minLength; j++) {
        if (pass.charCodeAt(i + j) !== charCode + j) {
          sequential = false;
          break;
        }
      }
      
      if (sequential) return true;
    }
    return false;
  };
  
  if (hasSequential(password)) score = Math.max(0, score - 1);

  // Return score (0-6) and appropriate feedback
  const getColorAndLabel = (score) => {
    if (score <= 1) return { color: '#dc3545', strength: 'Very Weak', feedback: 'Password is extremely vulnerable' };
    if (score <= 2) return { color: '#ffc107', strength: 'Weak', feedback: 'Add numbers and special characters' };
    if (score <= 3) return { color: '#fd7e14', strength: 'Fair', feedback: 'Try a longer password with mixed characters' };
    if (score <= 4) return { color: '#20c997', strength: 'Good', feedback: 'Getting better, add more variety' };
    if (score <= 5) return { color: '#0dcaf0', strength: 'Strong', feedback: 'Almost there!' };
    return { color: '#198754', strength: 'Very Strong', feedback: 'Excellent password!' };
  };
  
  const result = getColorAndLabel(score);
  return { 
    score, 
    strength: result.strength,
    feedback: result.feedback,
    color: result.color
  };
};

function PasswordStrengthMeter({ password }) {
  const [strength, setStrength] = useState({ score: 0, strength: '', feedback: '', color: '#dc3545' });
  
  useEffect(() => {
    setStrength(checkStrength(password));
  }, [password]);
  
  if (!password) {
    return null;
  }
  
  return (
    <div className="password-strength-meter">
      <div className="strength-meter">
        <div 
          className="strength-meter-fill" 
          style={{ 
            width: `${(strength.score / 6) * 100}%`,
            backgroundColor: strength.color,
            transition: 'width 0.5s, background-color 0.5s'
          }} 
        />
      </div>
      <div className="password-feedback">
        <span className="strength-label" style={{ color: strength.color }}>
          {strength.strength}: 
        </span> {strength.feedback}
      </div>
    </div>
  );
}

export default PasswordStrengthMeter;
