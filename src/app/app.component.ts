import { Component, OnInit } from '@angular/core';
import { EnvironmentService } from './services/environment.service';
import { Environment } from './models/environment';



@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit  {

  environment: Environment | undefined = undefined

  constructor(public environmentService: EnvironmentService) { }

  ngOnInit(): void {
    this.environmentService.getEnvironment().subscribe((environment) => {
      this.environment = environment;
    });
  }

  getCurrentYear(): number {
    return new Date().getFullYear();
  }


}


