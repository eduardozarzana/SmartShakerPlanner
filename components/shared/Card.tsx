import React, { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  title?: string;
  actions?: ReactNode;
}

const Card: React.FC<CardProps> = ({ children, className = '', title, actions, ...props }) => {
  return (
    <div {...props} className={`bg-white shadow-lg rounded-lg overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="px-4 py-3 border-b border-green-200 sm:px-6 flex justify-between items-center">
          {title && <h3 className="text-lg leading-6 font-medium text-green-800">{title}</h3>}
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className="p-4 sm:p-6 text-green-700">
        {children}
      </div>
    </div>
  );
};

export default Card;
