import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { App } from '../models/app';
import { Observable, map } from 'rxjs';
import { cacheBustingParams } from './cache-busting';

@Injectable({
  providedIn: 'root'
})
export class AppsService {

  constructor(public httpClient: HttpClient) { 

  }

  getApps(): Observable<App[]> {
    return this.httpClient.get<App[]>('/assets/apps.json', {
      params: cacheBustingParams()
    });
  }

  findByDeviceId(deviceId: string): Observable<App[]> {
    return this.getApps().pipe(
      map(apps => apps.filter(app => app.supportedDevices.includes(deviceId)))
    );
  }


  findById(id: string): Observable<App | undefined> {
    return this.getApps().pipe(
      map(apps => apps.find(app => app.id === id))
    );
  }
}
