import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EdiGeneratorComponent } from './components/edi-generator/edi-generator.component';
import { EdiVisualizerComponent } from './components/edi-visualizer/edi-visualizer.component';
import { ThemeService } from './services/theme.service';

type ActiveTool = 'generator' | 'visualizer';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, EdiGeneratorComponent, EdiVisualizerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'EDI Tools';
  activeTool = signal<ActiveTool>('generator');

  constructor(public themeService: ThemeService) {}

  setActiveTool(tool: ActiveTool): void {
    this.activeTool.set(tool);
  }
}
