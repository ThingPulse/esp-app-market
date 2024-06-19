import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DevicesService } from '../services/devices.service';
import { Device } from '../models/device';
import { AppsService } from '../services/apps.service';
import { App } from '../models/app';

@Component({
  selector: 'app-apps',
  templateUrl: './apps.component.html',
  styleUrls: ['./apps.component.css']
})
export class AppsComponent implements OnInit{

  deviceId: string;
  device: Device | undefined;
  apps: App[];

  constructor(private route: ActivatedRoute, 
              public deviceService: DevicesService,
              public appService: AppsService ) { }


  ngOnInit(): void {
    this.deviceId = this.route.snapshot.paramMap.get("deviceId")!;
    console.log(this.deviceId);
    this.deviceService.findById(this.deviceId).subscribe((device) => {  this.device = device; })
    console.log(this.device);
    this.appService.findByDeviceId(this.deviceId).subscribe((apps) => {
      this.apps = apps;
    });
  }

}
