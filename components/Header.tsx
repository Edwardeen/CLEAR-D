import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import React, { useState, useEffect, useRef } from 'react';
import logo from '../logo.png';
import { IIllness } from '../models/Illness'; // Import IIllness type

interface NavItem {
  href: string;
  label: string;
  icon?: JSX.Element;
}

interface NavItemGroup {
  label: string;
  isDropdown: boolean;
  href?: string; // For direct links
  items?: NavItem[]; // For dropdowns
}

// New Clustered Navigation Structure
const testsSubItemsStatic: NavItem[] = [
  { href: '/assessment/glaucoma', label: 'Glaucoma Test' },
  { href: '/assessment/cancer', label: 'Cancer Test' },
];

const findHelpSubItems: NavItem[] = [
  { href: '/hospitals', label: 'Find Hospitals' },
  { href: '/counselors', label: 'Find Counsellors' },
];

const navStructureBase: NavItemGroup[] = [
  { label: 'Home', href: '/', isDropdown: false },
  { label: 'Tests', isDropdown: true, items: testsSubItemsStatic }, // Use static as default
  { label: 'Find Help', isDropdown: true, items: findHelpSubItems },
  { label: 'Global Stats', href: '/stats', isDropdown: false },
];

const moreDropdownItems: NavItem[] = [
  { href: '/about', label: 'About Us' },
  { href: '/clear-d-card', label: 'Manage CLEAR-D Cards' },
];

const userDropdownItems: NavItem[] = [
  { href: '/profile', label: 'My Profile' },
];

// Create a function to get doctor-specific menu items
const getDoctorMenuItems = (role?: string): NavItem[] => {
  if (role === 'doctor') {
    return [{ href: '/doctor/dashboard', label: 'Doctor Dashboard' }];
  }
  return [];
};

const Header = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const [testsDropdownOpen, setTestsDropdownOpen] = useState(false);
  const [findHelpDropdownOpen, setFindHelpDropdownOpen] = useState(false);
  
  const [dynamicTestItems, setDynamicTestItems] = useState<NavItem[]>(testsSubItemsStatic);
  const [loadingIllnesses, setLoadingIllnesses] = useState<boolean>(true);

  const userDropdownRef = useRef<HTMLDivElement>(null);
  const moreDropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const testsDropdownRef = useRef<HTMLDivElement>(null);
  const findHelpDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchIllnessesForNav = async () => {
      setLoadingIllnesses(true);
      try {
        const response = await fetch('/api/illnesses');
        if (!response.ok) {
          console.error('Failed to fetch illnesses for header nav');
          setDynamicTestItems(testsSubItemsStatic); 
          return;
        }
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          const illnessItems: NavItem[] = result.data.map((illness: IIllness) => ({
            href: `/assessment/${illness.type.toLowerCase()}`,
            label: `${illness.name} Test`,
          }));
          // Ensure dynamicTestItems is updated, fallback if empty
          setDynamicTestItems(illnessItems.length > 0 ? illnessItems : testsSubItemsStatic);
        } else {
          console.warn('Illnesses API call did not return success or data was not an array.');
          setDynamicTestItems(testsSubItemsStatic); 
        }
      } catch (error) {
        console.error('Error fetching illnesses for header:', error);
        setDynamicTestItems(testsSubItemsStatic); 
      } finally {
        setLoadingIllnesses(false);
      }
    };

    fetchIllnessesForNav();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target as Node)) {
        setMoreDropdownOpen(false);
      }
      if (testsDropdownRef.current && !testsDropdownRef.current.contains(event.target as Node)) {
        setTestsDropdownOpen(false);
      }
      if (findHelpDropdownRef.current && !findHelpDropdownRef.current.contains(event.target as Node)) {
        setFindHelpDropdownOpen(false);
      }
      const mobileMenuButton = document.getElementById('mobile-menu-button');
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node) && (!mobileMenuButton || !mobileMenuButton.contains(event.target as Node))) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
    await signOut({ redirect: false, callbackUrl: '/login' });
    router.push('/login');
  };

  const NavLink = ({ href, children, isDropdownItem = false, onClick, isActiveOverride }: { href: string, children: React.ReactNode, isDropdownItem?: boolean, onClick?: () => void, isActiveOverride?: boolean }) => {
    const isActive = isActiveOverride !== undefined ? isActiveOverride : router.pathname === href;
    const baseClasses = isDropdownItem 
      ? "block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left" 
      : "px-3 py-2 rounded-md text-sm font-medium transition-colors";
    const activeClasses = isDropdownItem 
      ? "bg-gray-100 text-blue-600" 
      : "text-white bg-blue-600";
    const inactiveClasses = isDropdownItem 
      ? "text-gray-700 hover:bg-gray-100" 
      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900";

    const handleClick = () => {
      if (onClick) onClick();
      if (isDropdownItem) {
        setMobileMenuOpen(false);
        setUserDropdownOpen(false);
        setMoreDropdownOpen(false);
        setTestsDropdownOpen(false);
        setFindHelpDropdownOpen(false);
      }
    };

    return (
      <Link href={href} legacyBehavior>
        <a className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`} onClick={handleClick}>
          {children}
        </a>
      </Link>
    );
  };
  
  const Dropdown = ({ label, items, isOpen, setIsOpen, dropdownRef, navStructureItems }: { label: string, items: NavItem[], isOpen: boolean, setIsOpen: (isOpen: boolean) => void, dropdownRef: React.RefObject<HTMLDivElement>, navStructureItems?: NavItem[] }) => {
    const isActive = navStructureItems ? navStructureItems.some(item => router.pathname === item.href) : false;
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`px-3 py-2 rounded-md text-sm font-medium focus:outline-none flex items-center transition-colors ${isActive && !isOpen ? 'text-blue-600 bg-blue-50' : 'text-gray-700'} hover:bg-gray-100 hover:text-gray-900`}
        >
          {label}
          <svg className={`w-4 h-4 ml-1 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
        {isOpen && (
          <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-xl py-1 z-20">
            {items.map((item) => (
              <NavLink key={item.label} href={item.href} isDropdownItem onClick={() => setIsOpen(false)}>{item.label}</NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" legacyBehavior>
              <a className="flex items-center space-x-2" onClick={() => setMobileMenuOpen(false)}>
                <Image 
                src={logo} 
                alt="CLEAR-D Logo" 
                width={120} 
                height={40} 
                priority
                className="text-blue-600 object-contain" />
              </a>
            </Link>
            <p className="ml-3 text-xs text-gray-500 hidden md:block">
              Cancer & Glaucoma Early Recognition, Diabetes-Linked
            </p>
          </div>

          <nav className="hidden md:flex items-center space-x-1">
            {navStructureBase.map((group) => {
              if (group.isDropdown && group.items) {
                let setIsOpen;
                let isOpen;
                let ref;
                let currentItems = group.items; // Default to items from navStructureBase

                if (group.label === 'Tests') { 
                  setIsOpen = setTestsDropdownOpen; 
                  isOpen = testsDropdownOpen; 
                  ref = testsDropdownRef; 
                  currentItems = loadingIllnesses ? [{href: '#', label: 'Loading Tests...'}] : dynamicTestItems; 
                }
                else if (group.label === 'Find Help') { 
                  setIsOpen = setFindHelpDropdownOpen; 
                  isOpen = findHelpDropdownOpen; 
                  ref = findHelpDropdownRef; 
                }
                else { return null; }
                return <Dropdown key={group.label} label={group.label} items={currentItems} isOpen={isOpen} setIsOpen={setIsOpen} dropdownRef={ref} navStructureItems={currentItems} />;
              } else if (group.href) {
                return <NavLink key={group.label} href={group.href}>{group.label}</NavLink>;
              } else return null;
            })}
            <Dropdown label="More" items={moreDropdownItems} isOpen={moreDropdownOpen} setIsOpen={setMoreDropdownOpen} dropdownRef={moreDropdownRef} />
          </nav>

          <div className="hidden md:flex items-center space-x-3">
            {isLoading ? (
              <div className="h-8 w-24 animate-pulse bg-gray-200 rounded-md"></div>
            ) : session?.user ? (
              <div className="relative" ref={userDropdownRef}>
                <button onClick={() => setUserDropdownOpen(!userDropdownOpen)} className="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-100 focus:outline-none">
                  {session.user.image ? (
                    <Image src={session.user.image} alt="User" width={32} height={32} className="rounded-full object-cover" />
                  ) : (
                    <span className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center text-white font-semibold">
                      {session.user.name?.charAt(0).toUpperCase() || session.user.email?.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-sm text-gray-700 hidden lg:block">{session.user.name || session.user.email?.split('@')[0]}</span>
                   <svg className={`w-4 h-4 ml-1 transform transition-transform duration-200 hidden lg:block ${userDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-xl py-1 z-20">
                    {userDropdownItems.map((item) => (
                       <NavLink key={item.label} href={item.href} isDropdownItem onClick={() => setUserDropdownOpen(false)}>{item.label}</NavLink>
                    ))}
                    {/* Add doctor-specific menu items */}
                    {getDoctorMenuItems(session?.user?.role as string).map((item) => (
                       <NavLink key={item.label} href={item.href} isDropdownItem onClick={() => setUserDropdownOpen(false)}>{item.label}</NavLink>
                    ))}
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/login" legacyBehavior><a className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Login</a></Link>
                <Link href="/register" legacyBehavior><a className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Register</a></Link>
              </>
            )}
          </div>

          <div className="md:hidden flex items-center">
            <button
              id="mobile-menu-button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-expanded={mobileMenuOpen}
            >
              <span className="sr-only">Open main menu</span>
              {!mobileMenuOpen ? (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-8 6h8" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu - Needs to be updated for new navStructure */}
      {mobileMenuOpen && (
        <div ref={mobileMenuRef} className="md:hidden absolute top-16 inset-x-0 p-2 transition transform origin-top-right z-40">
          <div className="rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 bg-white divide-y-2 divide-gray-50">
            <div className="pt-5 pb-6 px-5 space-y-6">
              <div className="grid grid-cols-1 gap-y-4 gap-x-8">
                {navStructureBase.map((group: NavItemGroup) => { // Typed group
                  if (group.href && !group.isDropdown) {
                    return <NavLink key={group.label} href={group.href} onClick={() => setMobileMenuOpen(false)}>{group.label}</NavLink>;
                  }
                  if (group.isDropdown) {
                    let currentMobileItems = group.items || [];
                    if (group.label === 'Tests') {
                      currentMobileItems = loadingIllnesses ? [{href: '#', label: 'Loading Tests...'}] : dynamicTestItems;
                    }
                    return (
                      <div key={group.label}>
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{group.label}</p>
                        <div className="mt-1 space-y-1">
                          {currentMobileItems.map((item: NavItem) => ( // Typed item
                            <NavLink key={item.label} href={item.href} isDropdownItem onClick={() => setMobileMenuOpen(false)}>{item.label}</NavLink>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
                {/* 'More' dropdown items for mobile */}
                 <div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">More</p>
                    <div className="mt-1 space-y-1">
                      {moreDropdownItems.map((item: NavItem) => (
                        <NavLink key={item.label} href={item.href} isDropdownItem onClick={() => setMobileMenuOpen(false)}>{item.label}</NavLink>
                      ))}
                    </div>
                  </div>
              </div>
            </div>
            <div className="py-6 px-5">
              {isLoading ? (
                 <div className="h-8 w-full animate-pulse bg-gray-200 rounded-md mb-3"></div>
              ) : session?.user ? (
                <div className="space-y-3">
                   <p className="text-sm font-medium text-gray-700">Signed in as {session.user.name || session.user.email}</p>
                  {getDoctorMenuItems(session?.user?.role as string).map((item: NavItem) => (
                     <NavLink key={item.label} href={item.href} isDropdownItem onClick={() => setMobileMenuOpen(false)}>{item.label}</NavLink>
                  ))}
                  <NavLink href="/profile" isDropdownItem onClick={() => setMobileMenuOpen(false)}>My Profile</NavLink>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link href="/login" legacyBehavior><a onClick={() => setMobileMenuOpen(false)} className="block w-full px-5 py-3 text-center font-medium text-blue-600 bg-gray-50 hover:bg-gray-100 rounded-md">Login</a></Link>
                  <Link href="/register" legacyBehavior><a onClick={() => setMobileMenuOpen(false)} className="block w-full px-5 py-3 text-center font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">Register</a></Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header; 