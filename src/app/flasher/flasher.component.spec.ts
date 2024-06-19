import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlasherComponent } from './flasher.component';

describe('FlasherComponent', () => {
  let component: FlasherComponent;
  let fixture: ComponentFixture<FlasherComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FlasherComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FlasherComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
