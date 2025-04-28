import React, { ReactNode } from 'react';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
      <footer className="bg-gray-200 text-center p-4 text-sm text-gray-600 mt-auto">
        © {new Date().getFullYear()} Cancer & Glaucoma Early Automated Recognition – Diabetes-linked.
      </footer>
    </div>
  );
};

export default Layout; 