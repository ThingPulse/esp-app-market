import { Component } from '@angular/core';
import { DeviceDiagnostics } from '../models/device-diagnostics';
import { EspPortService } from '../services/esp-port.service';

@Component({
  selector: 'app-diagnostics',
  templateUrl: './diagnostics.component.html',
  styleUrls: ['./diagnostics.component.css']
})
export class DiagnosticsComponent {
  diagnostics: DeviceDiagnostics | null = null;
  loading = false;
  errorMessage = '';

  constructor(private portService: EspPortService) {}

  async inspectDevice(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    this.diagnostics = null;

    try {
      this.diagnostics = await this.portService.readDiagnostics();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Could not inspect the connected device.';
    } finally {
      this.loading = false;
    }
  }

  async disconnect(): Promise<void> {
    await this.portService.close();
  }

  exportReport(): void {
    if (!this.diagnostics) {
      return;
    }

    const blob = new Blob([JSON.stringify(this.diagnostics, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `esp-diagnostics-${this.diagnostics.chipFamily.toLowerCase()}-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  formatBytes(bytes: number | null): string {
    if (bytes === null) {
      return 'Unknown';
    }

    return `${bytes / (1024 * 1024)} MB`;
  }
}
