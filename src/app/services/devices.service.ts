import { HttpClient } from '@angular/common/http';
import { Injectable, OnInit } from '@angular/core';
import { Device } from '../models/device';
import { Observable, map, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DevicesService {

  constructor(public httpClient: HttpClient) { 

  }


  getDevices(): Observable<Device[]> {
    return this.httpClient.get<Device[]>('/assets/devices.json');
  }


  findById(id: string): Observable<Device | undefined> {
    return this.getDevices().pipe(
      map(devices => devices.find(device => device.id === id))
    );
  }
}
