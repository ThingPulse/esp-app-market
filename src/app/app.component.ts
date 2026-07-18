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
  theme: 'dark' | 'light' = 'dark';

  constructor(public environmentService: EnvironmentService) { }

  ngOnInit(): void {
    this.theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    this.environmentService.getEnvironment().subscribe((environment) => {
      this.environment = environment;
    });
  }

  getCurrentYear(): number {
    return new Date().getFullYear();
  }

  toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', this.theme);
    localStorage.setItem('esp-app-market-theme', this.theme);
  }


}

