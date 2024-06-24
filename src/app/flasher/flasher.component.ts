import { Component, OnInit } from '@angular/core';
import { Device } from '../models/device';
import { ActivatedRoute } from '@angular/router';
import { AppsService } from '../services/apps.service';
import { DevicesService } from '../services/devices.service';
import { App } from '../models/app';
import { EspPortService } from '../services/esp-port.service';
import { PartitionProgress } from '../services/utils.service';
import { Subscription } from 'rxjs';
import { AppVersion } from '../models/app-version';

@Component({
  selector: 'app-flasher',
  templateUrl: './flasher.component.html',
  styleUrls: ['./flasher.component.css']
})
export class FlasherComponent  implements OnInit{

  deviceId: string;
  appId: string;
  device: Device | undefined;
  app: App | undefined;

  private subscriptions: Subscription = new Subscription();

  private connected = false;
  private monitoring = false;

  messageArea: string = "";
  messageCount = 0;
  flasherConsole: string;
  selectedVersion: AppVersion | undefined;
  progresses: PartitionProgress[] = new Array();

  constructor(private route: ActivatedRoute, 
              public deviceService: DevicesService,
              public appService: AppsService, 
            public portService: EspPortService ) { }


  ngOnInit(): void {
    this.deviceId = this.route.snapshot.paramMap.get("deviceId")!;
    this.appId = this.route.snapshot.paramMap.get("appId")!;
    console.log(this.deviceId);
    this.deviceService.findById(this.deviceId).subscribe((device) => {  this.device = device; })
    console.log(this.device);
    this.appService.findById(this.appId).subscribe((app) => {
      this.app = app;
      this.selectedVersion = this.app?.versions[0];
    });
    const portStateStreamSubscription = this.portService.portStateStream.subscribe(isConnected => {
      console.log("isConnected: ", isConnected);
      this.connected = isConnected;
    });
    this.subscriptions.add(portStateStreamSubscription);
    const monitorStateSubscription = this.portService.monitorStateStream.subscribe(isMonitoring => {
      console.log("isMonitoring: ", isMonitoring);
      this.monitoring = isMonitoring;
    });
    this.subscriptions.add(monitorStateSubscription);

    const monitorStreamSubscription = this.portService.monitorMessageStream.subscribe(message => {

        this.messageArea = this.messageArea + '\n' + message;
        this.messageCount++;

      
    });
    this.subscriptions.add(monitorStreamSubscription);

    const flashProgressStreamSubscription = this.portService.flashProgressStream.subscribe(progress => {
      this.progresses[progress.index] = progress;
    });
    this.subscriptions.add(flashProgressStreamSubscription);

    const testStateStreamSubscription = this.portService.testStateStream.subscribe(state => {
      console.log("Test State: ", state);
    });
    this.subscriptions.add(testStateStreamSubscription);
  }

  resetState() {
    this.messageArea = ""
    this.messageCount = 0;
    this.flasherConsole = "Ready";
    this.progresses = new Array(this.selectedVersion?.partitions.length);
  }

  connect() {
   try {
    this.portService.connect();
   } catch (e) {
    this.flasherConsole = "Could not open port. Please close all open monitoring sessions or refresh this browser.";
   }
  }

  close() {
    this.portService.close();
  }

  isConnected() {
    return this.connected;
  }

  isMonitoring() {
    return this.monitoring;
  }

  startMonitor() {
    this.portService.startMonitor();
  }

  stopMonitor() {
    this.portService.stopMonitor();
  }

  reset() {
    this.portService.resetDevice();
  }

  async flash() {
    console.log("Flashing");
    this.resetState();
    if (this.app && this.selectedVersion?.partitions) {
      try {
        await this.portService.connect();
        console.log("Connected");
        } catch (e) {
          console.log(e);
          //this.flasherConsole = "Could not open port. Please close all open monitoring sessions or refresh this browser.";
          return;
        }
        console.log("Flashing");
        await this.portService.flash(this.selectedVersion.partitions);
    } else {
      console.log("No app selected");
    }
    
  }

}
