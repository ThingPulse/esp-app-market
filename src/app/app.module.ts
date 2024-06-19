import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from './material/material.module';
import { RouterModule, Routes } from '@angular/router';
import { DevicesComponent } from './devices/devices.component';
import { AppsComponent } from './apps/apps.component';
import { CacheInterceptor } from './services/cache.interceptor';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { FlasherComponent } from './flasher/flasher.component';

const routes: Routes = [
  { path: '', component: DevicesComponent },
  { path: 'device/:deviceId', component: AppsComponent },
  { path: 'device/:deviceId/app/:appId', component: FlasherComponent },
  { path: '**', redirectTo: '/', pathMatch: 'full' },
  
];

@NgModule({
  declarations: [
    AppComponent,
    DevicesComponent,
    AppsComponent,
    FlasherComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    BrowserAnimationsModule,
    MaterialModule,
    FormsModule,
    RouterModule.forRoot(routes)
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: CacheInterceptor, multi: true },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
