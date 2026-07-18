export interface DeviceDiagnostics {
  chipFamily: string;
  chipDescription: string;
  features: string[];
  crystalFrequencyMhz: number;
  macAddress: string;
  flashManufacturerId: string;
  flashDeviceId: string;
  flashSizeBytes: number | null;
  usbVendorId: string | null;
  usbProductId: string | null;
  inspectedAt: string;
}
