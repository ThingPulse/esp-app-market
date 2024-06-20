import { Component, OnInit } from '@angular/core';
import { DevicesService } from '../services/devices.service';
import { Device } from '../models/device';

@Component({
  selector: 'app-devices',
  templateUrl: './devices.component.html',
  styleUrls: ['./devices.component.css']
})
export class DevicesComponent implements OnInit {
  
  searchText: string = '';
  devices: Device[] = [];

  constructor(public deviceService: DevicesService) { }

  ngOnInit(): void {
    this.deviceService.getDevices().subscribe((devices) => {
      this.devices = devices;
    });
  }

}
