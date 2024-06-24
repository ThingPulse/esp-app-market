import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { App } from '../models/app';
import { Observable, map } from 'rxjs';
import { Environment } from '../models/environment';

@Injectable({
  providedIn: 'root'
})
export class EnvironmentService {

  constructor(public httpClient: HttpClient) { 

  }

  getEnvironment(): Observable<Environment> {
    return this.httpClient.get<Environment>('/assets/environment.json');
  }

}
