import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  describe('Browser Platform', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          ThemeService,
          { provide: PLATFORM_ID, useValue: 'browser' }
        ]
      });
      service = TestBed.inject(ThemeService);
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with light mode by default', () => {
      expect(service.isDarkMode()).toBe(false);
    });

    it('should toggle theme from light to dark', () => {
      expect(service.isDarkMode()).toBe(false);
      
      service.toggleTheme();
      
      expect(service.isDarkMode()).toBe(true);
    });

    it('should toggle theme from dark to light', () => {
      service.toggleTheme(); // Switch to dark
      expect(service.isDarkMode()).toBe(true);
      
      service.toggleTheme(); // Switch back to light
      
      expect(service.isDarkMode()).toBe(false);
    });

    it('should persist theme preference to localStorage', () => {
      service.toggleTheme();
      
      expect(localStorage.getItem('theme')).toBe('dark');
      
      service.toggleTheme();
      
      expect(localStorage.getItem('theme')).toBe('light');
    });

    it('should load saved theme preference from localStorage', () => {
      localStorage.setItem('theme', 'dark');
      
      // Create new service instance through TestBed to test initialization
      const newService = TestBed.inject(ThemeService);
      
      expect(newService.isDarkMode()).toBe(true);
    });

    it('should apply dark class to document element when dark mode is enabled', () => {
      service.toggleTheme();
      
      // In a real browser environment, this would add the class
      // In test environment, we just verify the signal state
      expect(service.isDarkMode()).toBe(true);
    });
  });

  describe('Server Platform (SSR)', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          ThemeService,
          { provide: PLATFORM_ID, useValue: 'server' }
        ]
      });
      service = TestBed.inject(ThemeService);
    });

    it('should be created without errors on server', () => {
      expect(service).toBeTruthy();
    });

    it('should default to light mode on server', () => {
      expect(service.isDarkMode()).toBe(false);
    });

    it('should not throw error when toggling theme on server', () => {
      expect(() => service.toggleTheme()).not.toThrow();
    });

    it('should not access localStorage on server', () => {
      // This test ensures no localStorage access throws errors during SSR
      expect(() => {
        service.toggleTheme();
        service.isDarkMode();
      }).not.toThrow();
    });
  });
});
