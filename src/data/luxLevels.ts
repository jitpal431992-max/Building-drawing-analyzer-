import { InventoryRow } from '../types';

export interface LuxLevelReference {
  id: string;
  buildingGroup: string;
  slNo: string;
  label: string;
  luxDisplay: string;
  minLux: number;
  maxLux: number;
  recommendedLux: number;
  isSpecialLighting?: boolean;
}

export const LUX_BUILDING_GROUPS = [
  '1. HOMES',
  '2. OFFICES',
  '3. SCHOOLS & COLLEGES',
  '4. HOSPITALS',
  '5. DAIRIES',
  '6. SUB-STATION',
  '7. CINEMA / THEATRE',
  '16. DISTRIBUTION AND STORAGE',
  '17.3 BANKS & BUILDING SOCIETIES',
  '18. SERVICES — GARAGES',
  '20.1 & 20.8 PUBLIC ASSEMBLY & SPORTS',
  '20.5 HOTELS',
  '20.6 LIBRARIES',
  '20.7 MUSEUMS & ART GALLERIES',
  '23. GENERAL BUILDING AREAS',
] as const;

export const IS_3646_LUX_REFERENCES: LuxLevelReference[] = [
  // 1. HOMES (IS:3646 Part II)
  { id: 'home-kitchen', buildingGroup: '1. HOMES', slNo: '1(a)', label: 'Kitchen', luxDisplay: '200', minLux: 200, maxLux: 200, recommendedLux: 200 },
  { id: 'home-bathroom', buildingGroup: '1. HOMES', slNo: '1(b)', label: 'Bathroom', luxDisplay: '100*', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'home-stairs', buildingGroup: '1. HOMES', slNo: '1(c)', label: 'Stairs', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'home-garage', buildingGroup: '1. HOMES', slNo: '1(d)', label: 'Garage', luxDisplay: '70', minLux: 70, maxLux: 70, recommendedLux: 70 },
  { id: 'home-sewing-dining', buildingGroup: '1. HOMES', slNo: '1(e)', label: 'Sewing & Dining', luxDisplay: '700', minLux: 700, maxLux: 700, recommendedLux: 700 },
  { id: 'home-reading-casual', buildingGroup: '1. HOMES', slNo: '1(f)', label: 'Reading (Casual)', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'home-homework', buildingGroup: '1. HOMES', slNo: '1(g)', label: 'Homework & sustained reading', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },

  // 2. OFFICES (Updated per IS 3646 Part 1 : 1992 — 17.1 Offices & 17.2 Drawing Offices)
  { id: 'office-general', buildingGroup: '2. OFFICES', slNo: '17.1.1', label: 'Offices — General offices', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'office-deep-plan', buildingGroup: '2. OFFICES', slNo: '17.1.2', label: 'Offices — Deep plan general offices', luxDisplay: '750', minLux: 750, maxLux: 750, recommendedLux: 750 },
  { id: 'office-computer-workstations', buildingGroup: '2. OFFICES', slNo: '17.1.3', label: 'Offices — Computer work stations', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'office-conference', buildingGroup: '2. OFFICES', slNo: '17.1.4', label: 'Offices — Conference rooms, executive offices', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'office-computer-data-prep', buildingGroup: '2. OFFICES', slNo: '17.1.5', label: 'Offices — Computer and data preparation rooms', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'office-filing', buildingGroup: '2. OFFICES', slNo: '17.1.6', label: 'Offices — Filing rooms', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'office-drawing-general', buildingGroup: '2. OFFICES', slNo: '17.2.1', label: 'Drawing Offices — General', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'office-drawing-boards', buildingGroup: '2. OFFICES', slNo: '17.2.2', label: 'Drawing Offices — Drawing boards', luxDisplay: '750', minLux: 750, maxLux: 750, recommendedLux: 750 },
  { id: 'office-drawing-cad', buildingGroup: '2. OFFICES', slNo: '17.2.3', label: 'Drawing Offices — Computer aided design and drafting', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'office-drawing-print', buildingGroup: '2. OFFICES', slNo: '17.2.4', label: 'Drawing Offices — Print rooms', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },

  // 3. SCHOOLS & COLLEGES (Updated per IS 3646 Part 1 : 1992 — 21. EDUCATION)
  { id: 'edu-assembly-general', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '21.1.1', label: 'Assembly Halls — General', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'edu-assembly-stage', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '21.1.2', label: 'Assembly Halls — Platform and stage', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'edu-teaching-general', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '21.2', label: 'Teaching Spaces — General', luxDisplay: 'Special / 300*', minLux: 300, maxLux: 500, recommendedLux: 300, isSpecialLighting: true },
  { id: 'edu-lecture-general', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '21.3.1', label: 'Lecture Theatres — General', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'edu-lecture-demo', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '21.3.2', label: 'Lecture Theatres — Demonstration benches', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'edu-seminar', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '21.4', label: 'Seminar Rooms', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'school-art-room', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '21.5', label: 'Art Rooms', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'school-embroidery-sewing', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '21.6', label: 'Needlework Rooms', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'school-laboratory', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '21.7', label: 'Laboratories', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'edu-libraries', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '21.8', label: 'Libraries', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'edu-music', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '21.9', label: 'Music Rooms', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'edu-sports-halls', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '21.10', label: 'Sports Halls', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'edu-workshops', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '21.11', label: 'Workshops', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },

  // 4. HOSPITALS (Updated per IS 3646 Part 1 : 1992 — 20.4 Hospitals)
  { id: 'hospital-anaesthetic-general', buildingGroup: '4. HOSPITALS', slNo: '20.4.1.1', label: 'Anaesthetic rooms — General', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'hospital-anaesthetic-local', buildingGroup: '4. HOSPITALS', slNo: '20.4.1.2', label: 'Anaesthetic rooms — Local', luxDisplay: '1,000', minLux: 1000, maxLux: 1000, recommendedLux: 1000 },
  { id: 'hospital-consulting-area-general', buildingGroup: '4. HOSPITALS', slNo: '20.4.2.1', label: 'Consulting areas — General', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'hospital-consulting-area-exam', buildingGroup: '4. HOSPITALS', slNo: '20.4.2.2', label: 'Consulting areas — Examination', luxDisplay: '1,000', minLux: 1000, maxLux: 1000, recommendedLux: 1000 },
  { id: 'hospital-corridors-general', buildingGroup: '4. HOSPITALS', slNo: '20.4.3.1', label: 'Corridors — General', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'hospital-ward-corr-day-screened', buildingGroup: '4. HOSPITALS', slNo: '20.4.4.1', label: 'Ward corridors — Day, screened from bays', luxDisplay: '200', minLux: 200, maxLux: 200, recommendedLux: 200 },
  { id: 'hospital-ward-corr-day-natural', buildingGroup: '4. HOSPITALS', slNo: '20.4.4.2', label: 'Ward corridors — Day, open to natural light', luxDisplay: '200', minLux: 200, maxLux: 200, recommendedLux: 200 },
  { id: 'hospital-ward-corr-morning-evening', buildingGroup: '4. HOSPITALS', slNo: '20.4.4.3', label: 'Ward corridors — Morning/evening', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'hospital-ward-corr-night', buildingGroup: '4. HOSPITALS', slNo: '20.4.4.4', label: 'Ward corridors — Night', luxDisplay: '7.5', minLux: 7.5, maxLux: 7.5, recommendedLux: 7.5 },
  { id: 'hospital-cubicles-general', buildingGroup: '4. HOSPITALS', slNo: '20.4.5.1', label: 'Cubicles — General', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'hospital-cubicles-treatment', buildingGroup: '4. HOSPITALS', slNo: '20.4.5.2', label: 'Cubicles — Treatment', luxDisplay: '1,000', minLux: 1000, maxLux: 1000, recommendedLux: 1000 },
  { id: 'hospital-exam-general', buildingGroup: '4. HOSPITALS', slNo: '20.4.6.1', label: 'Examination — General', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'hospital-exam-local', buildingGroup: '4. HOSPITALS', slNo: '20.4.6.2', label: 'Examination — Local inspection', luxDisplay: '1,000', minLux: 1000, maxLux: 1000, recommendedLux: 1000 },
  { id: 'hospital-icu-bedhead', buildingGroup: '4. HOSPITALS', slNo: '20.4.7.1', label: 'Intensive therapy — Bed head', luxDisplay: '40', minLux: 40, maxLux: 40, recommendedLux: 40 },
  { id: 'hospital-icu-circulation', buildingGroup: '4. HOSPITALS', slNo: '20.4.7.2', label: 'Intensive therapy — Circulation between bed ends', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'hospital-icu-observation', buildingGroup: '4. HOSPITALS', slNo: '20.4.7.3', label: 'Intensive therapy — Observation', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'hospital-icu-local-obs', buildingGroup: '4. HOSPITALS', slNo: '20.4.7.4', label: 'Intensive therapy — Local observation', luxDisplay: '1,000', minLux: 1000, maxLux: 1000, recommendedLux: 1000 },
  { id: 'hospital-icu-staff-day', buildingGroup: '4. HOSPITALS', slNo: '20.4.7.5', label: 'Intensive therapy — Staff base (day)', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'hospital-icu-staff-night', buildingGroup: '4. HOSPITALS', slNo: '20.4.7.6', label: 'Intensive therapy — Staff base (night)', luxDisplay: '30', minLux: 30, maxLux: 30, recommendedLux: 30 },
  { id: 'hospital-laboratories', buildingGroup: '4. HOSPITALS', slNo: '20.4.8.1', label: 'Laboratories — General', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'hospital-lab-examination', buildingGroup: '4. HOSPITALS', slNo: '20.4.8.2', label: 'Laboratories — Examination', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'hospital-nurse-day', buildingGroup: '4. HOSPITALS', slNo: '20.4.9.1', label: "Nurses' stations — Morning/day/evening", luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'hospital-nurse-night-desk', buildingGroup: '4. HOSPITALS', slNo: '20.4.9.2', label: "Nurses' stations — Night desks", luxDisplay: '30', minLux: 30, maxLux: 30, recommendedLux: 30 },
  { id: 'hospital-nurse-night-trolley', buildingGroup: '4. HOSPITALS', slNo: '20.4.9.3', label: "Nurses' stations — Night, medical trolleys", luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'hospital-ot-general', buildingGroup: '4. HOSPITALS', slNo: '20.4.10.1', label: 'Operating theatres — General', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'hospital-ot-tables', buildingGroup: '4. HOSPITALS', slNo: '20.4.10.2', label: 'Operating theatres — Local', luxDisplay: '30,000', minLux: 30000, maxLux: 30000, recommendedLux: 30000, isSpecialLighting: true },
  { id: 'hospital-pathology-general', buildingGroup: '4. HOSPITALS', slNo: '20.4.11.1', label: 'Pathology departments — General', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'hospital-pathology-exam', buildingGroup: '4. HOSPITALS', slNo: '20.4.11.2', label: 'Pathology departments — Examination', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'hospital-dispensaries', buildingGroup: '4. HOSPITALS', slNo: '20.4.11.3', label: 'Pathology departments — Pharmacies', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'hospital-reception', buildingGroup: '4. HOSPITALS', slNo: '20.4.11.4', label: 'Pathology departments — Reception/enquiry', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'hospital-recovery', buildingGroup: '4. HOSPITALS', slNo: '20.4.11.5', label: 'Pathology departments — Recovery rooms', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'hospital-wards-general', buildingGroup: '4. HOSPITALS', slNo: '20.4.12.1', label: 'Ward-circulation — Day', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'hospital-ward-circ-morning-eve', buildingGroup: '4. HOSPITALS', slNo: '20.4.12.2', label: 'Ward-circulation — Morning/evening', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'hospital-ward-circ-night', buildingGroup: '4. HOSPITALS', slNo: '20.4.12.3', label: 'Ward-circulation — Night', luxDisplay: '4', minLux: 4, maxLux: 4, recommendedLux: 4 },
  { id: 'hospital-ward-bed-morning-eve', buildingGroup: '4. HOSPITALS', slNo: '20.4.13.1', label: 'Ward-bed head — Morning/evening', luxDisplay: '40', minLux: 40, maxLux: 40, recommendedLux: 40 },
  { id: 'hospital-wards-beds', buildingGroup: '4. HOSPITALS', slNo: '20.4.13.2', label: 'Ward-bed head — Reading', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'hospital-night-ward-adult', buildingGroup: '4. HOSPITALS', slNo: '20.4.14.1', label: 'Night (Wards) — Adult', luxDisplay: '0.55', minLux: 0.55, maxLux: 0.55, recommendedLux: 0.55 },
  { id: 'hospital-night-ward-paediatric', buildingGroup: '4. HOSPITALS', slNo: '20.4.14.2', label: 'Night (Wards) — Paediatric', luxDisplay: '1', minLux: 1, maxLux: 1, recommendedLux: 1 },
  { id: 'hospital-night-ward-psychiatric', buildingGroup: '4. HOSPITALS', slNo: '20.4.14.3', label: 'Night (Wards) — Psychiatric', luxDisplay: '3', minLux: 3, maxLux: 3, recommendedLux: 3 },
  { id: 'hospital-night-ward-watch', buildingGroup: '4. HOSPITALS', slNo: '20.4.14.4', label: 'Night (Wards) — Watch', luxDisplay: '5', minLux: 5, maxLux: 5, recommendedLux: 5 },
  { id: 'hospital-radiology', buildingGroup: '4. HOSPITALS', slNo: '20.4.15.1', label: 'X-Ray areas — General', luxDisplay: '200', minLux: 200, maxLux: 200, recommendedLux: 200 },
  { id: 'hospital-xray-diagnostic', buildingGroup: '4. HOSPITALS', slNo: '20.4.15.2', label: 'X-Ray areas — Diagnostic', luxDisplay: '200', minLux: 200, maxLux: 200, recommendedLux: 200 },
  { id: 'hospital-xray-operative', buildingGroup: '4. HOSPITALS', slNo: '20.4.15.3', label: 'X-Ray areas — Operative', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'hospital-xray-darkroom', buildingGroup: '4. HOSPITALS', slNo: '20.4.15.4', label: 'X-Ray areas — Process dark room', luxDisplay: '50', minLux: 50, maxLux: 50, recommendedLux: 50 },
  { id: 'hospital-surgeries-general', buildingGroup: '4. HOSPITALS', slNo: '20.4.16.1', label: 'Surgeries — General', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'hospital-casualty-opd', buildingGroup: '4. HOSPITALS', slNo: '20.4.16.2', label: 'Surgeries — Waiting rooms', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'hospital-dental-chair', buildingGroup: '4. HOSPITALS', slNo: '20.4.17.1', label: 'Dental surgeries — Chair', luxDisplay: 'Special Lighting', minLux: 1000, maxLux: 1000, recommendedLux: 1000, isSpecialLighting: true },
  { id: 'hospital-dental-lab', buildingGroup: '4. HOSPITALS', slNo: '20.4.17.2', label: 'Dental surgeries — Laboratories', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'hospital-consult-room-general', buildingGroup: '4. HOSPITALS', slNo: '20.4.18.1', label: 'Consulting rooms — General', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'hospital-consult-room-desk', buildingGroup: '4. HOSPITALS', slNo: '20.4.18.2', label: 'Consulting rooms — Desk', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'hospital-consult-room-couch', buildingGroup: '4. HOSPITALS', slNo: '20.4.18.3', label: 'Consulting rooms — Examination couch', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'hospital-consult-room-ophthalmic', buildingGroup: '4. HOSPITALS', slNo: '20.4.18.4', label: 'Consulting rooms — Ophthalmic wall and near-vision charts', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },

  // 5. DAIRIES (IS:3646 Part II)
  { id: 'dairy-general', buildingGroup: '5. DAIRIES', slNo: '5(a)', label: 'General working areas', luxDisplay: '200%', minLux: 200, maxLux: 200, recommendedLux: 200 },
  { id: 'dairy-bottle-inspection', buildingGroup: '5. DAIRIES', slNo: '5(b)', label: 'Bottle inspection', luxDisplay: 'Special Lighting', minLux: 500, maxLux: 500, recommendedLux: 500, isSpecialLighting: true },
  { id: 'dairy-bottle-filling', buildingGroup: '5. DAIRIES', slNo: '5(c)', label: 'Bottle Filling', luxDisplay: '450', minLux: 450, maxLux: 450, recommendedLux: 450 },

  // 6. SUB-STATION (IS:3646 Part II)
  { id: 'substation-switchroom', buildingGroup: '6. SUB-STATION', slNo: '6(a)', label: 'Transformer, HT & LT Switch room', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'substation-control', buildingGroup: '6. SUB-STATION', slNo: '6(b)', label: 'Control Rooms', luxDisplay: '200-300', minLux: 200, maxLux: 300, recommendedLux: 250 },

  // 7. CINEMA / THEATRE (Updated per IS 3646 Part 1 : 1992 — 20.2 Concert Halls, Cinemas and Theatres)
  { id: 'cinema-foyers', buildingGroup: '7. CINEMA / THEATRE', slNo: '20.2.1', label: 'Foyer', luxDisplay: '200', minLux: 200, maxLux: 200, recommendedLux: 200 },
  { id: 'cinema-booking-office', buildingGroup: '7. CINEMA / THEATRE', slNo: '20.2.2', label: 'Booking office', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'cinema-auditorium', buildingGroup: '7. CINEMA / THEATRE', slNo: '20.2.3', label: 'Auditorium', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'cinema-dressing-rooms', buildingGroup: '7. CINEMA / THEATRE', slNo: '20.2.4', label: 'Dressing rooms', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'cinema-projection-room', buildingGroup: '7. CINEMA / THEATRE', slNo: '20.2.5', label: 'Projection room', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },

  // 16. DISTRIBUTION AND STORAGE (IS 3646 Part 1 : 1992)
  { id: 'dist-work-stores-general', buildingGroup: '16. DISTRIBUTION AND STORAGE', slNo: '16.1', label: 'Work Stores (General / Unspecified)', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'dist-work-stores-unpacking', buildingGroup: '16. DISTRIBUTION AND STORAGE', slNo: '16.1.1', label: 'Work Stores — Unpacking, sorting', luxDisplay: '200', minLux: 200, maxLux: 200, recommendedLux: 200 },
  { id: 'dist-work-stores-large', buildingGroup: '16. DISTRIBUTION AND STORAGE', slNo: '16.1.2', label: 'Work Stores — Large item storage', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'dist-work-stores-small-rack', buildingGroup: '16. DISTRIBUTION AND STORAGE', slNo: '16.1.3', label: 'Work Stores — Small item rack storage', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'dist-work-stores-counter', buildingGroup: '16. DISTRIBUTION AND STORAGE', slNo: '16.1.4', label: "Work Stores — Issue counter, records, storeman's desk", luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'dist-warehouse-limited', buildingGroup: '16. DISTRIBUTION AND STORAGE', slNo: '16.2.1', label: 'Warehouses & Bulk Stores — Goods requiring limited perception of detail', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'dist-warehouse-detail', buildingGroup: '16. DISTRIBUTION AND STORAGE', slNo: '16.2.2', label: 'Warehouses & Bulk Stores — Goods requiring perception of detail', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'dist-highbay-gangway', buildingGroup: '16. DISTRIBUTION AND STORAGE', slNo: '16.2.3.1', label: 'Automatic high bay rack stores — Gangway', luxDisplay: '20', minLux: 20, maxLux: 20, recommendedLux: 20 },
  { id: 'dist-highbay-control', buildingGroup: '16. DISTRIBUTION AND STORAGE', slNo: '16.2.3.2', label: 'Automatic high bay rack stores — Control station', luxDisplay: '200', minLux: 200, maxLux: 200, recommendedLux: 200 },
  { id: 'dist-highbay-packing', buildingGroup: '16. DISTRIBUTION AND STORAGE', slNo: '16.2.3.3', label: 'Automatic high bay rack stores — Packing and despatch', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'dist-highbay-loading', buildingGroup: '16. DISTRIBUTION AND STORAGE', slNo: '16.2.3.4', label: 'Automatic high bay rack stores — Loading bays', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'dist-coldstore-general', buildingGroup: '16. DISTRIBUTION AND STORAGE', slNo: '16.3.1', label: 'Cold Stores — General', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'dist-coldstore-breakdown', buildingGroup: '16. DISTRIBUTION AND STORAGE', slNo: '16.3.2', label: 'Cold Stores — Breakdown, make-up and despatch', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'dist-coldstore-loading', buildingGroup: '16. DISTRIBUTION AND STORAGE', slNo: '16.3.3', label: 'Cold Stores — Loading bays', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },

  // 17.3 BANKS & BUILDING SOCIETIES (IS 3646 Part 1 : 1992)
  { id: 'bank-counter-office', buildingGroup: '17.3 BANKS & BUILDING SOCIETIES', slNo: '17.3.1', label: 'Counter, office area', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'bank-public-area', buildingGroup: '17.3 BANKS & BUILDING SOCIETIES', slNo: '17.3.2', label: 'Public area', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },

  // 18. SERVICES — GARAGES (IS 3646 Part 1 : 1992)
  { id: 'garage-interior-parking', buildingGroup: '18. SERVICES — GARAGES', slNo: '18.1.1', label: 'Interior parking areas', luxDisplay: '30', minLux: 30, maxLux: 30, recommendedLux: 30 },
  { id: 'garage-repairs', buildingGroup: '18. SERVICES — GARAGES', slNo: '18.1.2', label: 'General repairs, servicing, washing, polishing', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'garage-workbench', buildingGroup: '18. SERVICES — GARAGES', slNo: '18.1.3', label: 'Workbench', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'garage-spray-booths', buildingGroup: '18. SERVICES — GARAGES', slNo: '18.1.4', label: 'Spray booths', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },

  // 20.1 & 20.8 PUBLIC ASSEMBLY & SPORTS (IS 3646 Part 1 : 1992)
  { id: 'public-assembly-halls', buildingGroup: '20.1 & 20.8 PUBLIC ASSEMBLY & SPORTS', slNo: '20.1', label: 'Public Rooms, Village Halls, Worship Halls', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'sports-multipurpose-halls', buildingGroup: '20.1 & 20.8 PUBLIC ASSEMBLY & SPORTS', slNo: '20.8', label: 'Sports Facilities — Multi-purpose sports halls', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },

  // 20.5 HOTELS (IS 3646 Part 1 : 1992)
  { id: 'hotel-entrance-halls', buildingGroup: '20.5 HOTELS', slNo: '20.5.1', label: 'Entrance halls', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'hotel-reception-desks', buildingGroup: '20.5 HOTELS', slNo: '20.5.2', label: "Reception, cashier's and porters' desks", luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'hotel-bars-dining', buildingGroup: '20.5 HOTELS', slNo: '20.5.3', label: 'Bars, coffee base, dining rooms, grill rooms, restaurants, lounges', luxDisplay: '125', minLux: 125, maxLux: 125, recommendedLux: 125 },
  { id: 'hotel-cloak-baggage', buildingGroup: '20.5 HOTELS', slNo: '20.5.4', label: 'Cloak rooms, baggage rooms', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'hotel-bedrooms', buildingGroup: '20.5 HOTELS', slNo: '20.5.5', label: 'Bed rooms', luxDisplay: '50', minLux: 50, maxLux: 50, recommendedLux: 50 },
  { id: 'hotel-bathroom', buildingGroup: '20.5 HOTELS', slNo: '20.5.6', label: 'Bathroom', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'hotel-food-prep-corridors', buildingGroup: '20.5 HOTELS', slNo: '20.5.7', label: 'Food preparation and stores, cellars, lifts and corridors', luxDisplay: 'Special / 200*', minLux: 100, maxLux: 500, recommendedLux: 200, isSpecialLighting: true },

  // 20.6 LIBRARIES (IS 3646 Part 1 : 1992)
  { id: 'lib-lending-general', buildingGroup: '20.6 LIBRARIES', slNo: '20.6.1.1', label: 'Lending library — General', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'lib-lending-counters', buildingGroup: '20.6 LIBRARIES', slNo: '20.6.1.2', label: 'Lending library — Counters', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'lib-lending-bookshelves', buildingGroup: '20.6 LIBRARIES', slNo: '20.6.1.3', label: 'Lending library — Bookshelves', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'lib-lending-reading-rooms', buildingGroup: '20.6 LIBRARIES', slNo: '20.6.1.4', label: 'Lending library — Reading rooms', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'lib-lending-reading-tables', buildingGroup: '20.6 LIBRARIES', slNo: '20.6.1.5', label: 'Lending library — Reading tables', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'lib-catalogue-card', buildingGroup: '20.6 LIBRARIES', slNo: '20.6.2.1', label: 'Catalogues — Card', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'lib-catalogue-microfiche', buildingGroup: '20.6 LIBRARIES', slNo: '20.6.2.2', label: 'Catalogues — Microfiche/Visual display units', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'lib-ref-general', buildingGroup: '20.6 LIBRARIES', slNo: '20.6.3.1', label: 'Reference libraries — General', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'lib-ref-counters', buildingGroup: '20.6 LIBRARIES', slNo: '20.6.3.2', label: 'Reference libraries — Counters', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'lib-ref-bookshelves', buildingGroup: '20.6 LIBRARIES', slNo: '20.6.3.3', label: 'Reference libraries — Bookshelves', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'lib-ref-study-tables', buildingGroup: '20.6 LIBRARIES', slNo: '20.6.3.4', label: 'Reference libraries — Study tables, carrels', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'lib-ref-map-room', buildingGroup: '20.6 LIBRARIES', slNo: '20.6.3.5', label: 'Reference libraries — Map room', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'lib-display-insensitive', buildingGroup: '20.6 LIBRARIES', slNo: '20.6.4.1', label: 'Display & exhibition — Exhibits insensitive to light', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'lib-display-sensitive', buildingGroup: '20.6 LIBRARIES', slNo: '20.6.4.2', label: 'Display & exhibition — Exhibit sensitive to light (pictures, prints, rare books)', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'lib-workroom-repair', buildingGroup: '20.6 LIBRARIES', slNo: '20.6.5.1', label: 'Library workrooms — Book repair and binding', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'lib-workroom-sorting', buildingGroup: '20.6 LIBRARIES', slNo: '20.6.5.2', label: 'Library workrooms — Catalogue and sorting', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'lib-workroom-remote-store', buildingGroup: '20.6 LIBRARIES', slNo: '20.6.5.3', label: 'Library workrooms — Remote book stores', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },

  // 20.7 MUSEUMS & ART GALLERIES (IS 3646 Part 1 : 1992)
  { id: 'museum-insensitive', buildingGroup: '20.7 MUSEUMS & ART GALLERIES', slNo: '20.7.1', label: 'Exhibits insensitive to light', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'museum-light-sensitive', buildingGroup: '20.7 MUSEUMS & ART GALLERIES', slNo: '20.7.2', label: 'Light sensitive exhibits (oil/tempera paints, leather, bone, ivory, wood)', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'museum-extremely-sensitive', buildingGroup: '20.7 MUSEUMS & ART GALLERIES', slNo: '20.7.3', label: 'Extremely light sensitive exhibits (textiles, water colours, prints, botanical)', luxDisplay: '50', minLux: 50, maxLux: 50, recommendedLux: 50 },
  { id: 'museum-conservation', buildingGroup: '20.7 MUSEUMS & ART GALLERIES', slNo: '20.7.4', label: 'Conservation studies and workshops', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },

  // 23. GENERAL BUILDING AREAS (IS 3646 Part 1 : 1992)
  { id: 'gen-entrance-halls', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.1.1', label: 'Entrance — Entrance halls, lobbies, waiting rooms', luxDisplay: '200', minLux: 200, maxLux: 200, recommendedLux: 200 },
  { id: 'gen-entrance-enquiry', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.1.2', label: 'Entrance — Enquiry desks', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'gen-entrance-gatehouses', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.1.3', label: 'Entrance — Gatehouses', luxDisplay: '200', minLux: 200, maxLux: 200, recommendedLux: 200 },
  { id: 'gen-circ-lifts', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.2.1', label: 'Circulation Areas — Lifts', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'gen-circ-corridors', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.2.2', label: 'Circulation Areas — Corridors, passageways, stairs', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'gen-circ-escalators', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.2.3', label: 'Circulation Areas — Escalators, travellators', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'gen-medical-consulting', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.3.1', label: 'Medical & First Aid Centres — Consulting rooms, treatment rooms', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'gen-medical-rest', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.3.2', label: 'Medical & First Aid Centres — Rest rooms', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'gen-medical-stores', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.3.3', label: 'Medical & First Aid Centres — Medical stores', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'gen-staff-changing-lavatory', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.4.1', label: 'Staff Rooms — Changing, locker, cleaners rooms, cloakrooms, lavatories', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'gen-staff-rest', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.4.2', label: 'Staff Rooms — Rest rooms', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'gen-restaurant-canteen', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.5.1', label: 'Staff Restaurants — Canteens, cafeterias, dining rooms, mess rooms', luxDisplay: '200', minLux: 200, maxLux: 200, recommendedLux: 200 },
  { id: 'gen-restaurant-servery', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.5.2', label: 'Staff Restaurants — Servery, vegetable preparation, washing-up area', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'gen-restaurant-kitchen', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.5.3', label: 'Staff Restaurants — Food preparation and cooking', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'gen-restaurant-stores', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.5.4', label: 'Staff Restaurants — Food stores, cellars', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'gen-comm-switchboard', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.6.1', label: 'Communications — Switchboard rooms', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'gen-comm-telephone', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.6.2', label: 'Communications — Telephone apparatus rooms', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'gen-comm-telex-post', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.6.3', label: 'Communications — Telex room, post room', luxDisplay: '500', minLux: 500, maxLux: 500, recommendedLux: 500 },
  { id: 'gen-comm-reprographic', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.6.4', label: 'Communications — Reprographic room', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'gen-services-boiler-general', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.7.1.1', label: 'Boiler houses — General', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'gen-services-boiler-front', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.7.1.2', label: 'Boiler houses — Boiler front', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'gen-services-boiler-control', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.7.1.3', label: 'Boiler houses — Boiler control room', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'gen-services-control-rooms', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.7.1.4', label: 'Building Services — Control rooms', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'gen-services-mechanical-plant', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.7.1.5', label: 'Building Services — Mechanical plant room', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'gen-services-electrical-dist', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.7.1.6', label: 'Building Services — Electrical power supply and distribution rooms', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'gen-services-store-rooms', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.7.1.7', label: 'Building Services — Store rooms', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'gen-carpark-covered-floors', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.8.1.1', label: 'Covered car parks — Floors', luxDisplay: '12.5', minLux: 12.5, maxLux: 12.5, recommendedLux: 12.5 },
  { id: 'gen-carpark-covered-ramps', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.8.1.2', label: 'Covered car parks — Ramps and corners', luxDisplay: '30', minLux: 30, maxLux: 30, recommendedLux: 30 },
  { id: 'gen-carpark-covered-entrances', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.8.1.3', label: 'Covered car parks — Entrances and exits', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'gen-carpark-covered-control', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.8.1.4', label: 'Covered car parks — Control booths', luxDisplay: '200', minLux: 200, maxLux: 200, recommendedLux: 200 },
  { id: 'gen-carpark-outdoor', buildingGroup: '23. GENERAL BUILDING AREAS', slNo: '23.8.1.5', label: 'Car Parks — Outdoor car parks', luxDisplay: '12.5', minLux: 12.5, maxLux: 12.5, recommendedLux: 12.5 },
];

// Backward-compatibility mapping for legacy IS:3646 (1966) IDs persisted in localStorage
const LEGACY_LUX_ID_MAP: Record<string, string> = {
  'office-entrance': 'gen-entrance-halls',
  'office-business-machine': 'office-computer-workstations',
  'office-corridor-lift': 'gen-circ-corridors',
  'office-stairs': 'gen-circ-corridors',
  'office-lift-landing': 'gen-circ-lifts',
  'office-tel-manual': 'gen-comm-switchboard',
  'office-tel-mdf': 'gen-comm-telephone',
  'school-assembly-central': 'edu-assembly-general',
  'school-assembly-exam': 'edu-assembly-general',
  'school-assembly-platforms': 'edu-assembly-stage',
  'school-class-desks': 'edu-teaching-general',
  'school-class-chalkboards': 'edu-teaching-general',
  'school-library-shelves': 'lib-lending-bookshelves',
  'school-library-reading': 'edu-libraries',
  'school-offices': 'office-general',
  'school-staff-room': 'gen-staff-rest',
  'school-corridor': 'gen-circ-corridors',
  'school-stairs': 'gen-circ-corridors',
  'hospital-stairs-corridors': 'hospital-corridors-general',
  'cinema-corridors': 'gen-circ-corridors',
  'cinema-stairs': 'gen-circ-corridors',
};

export function resolveLuxReferenceId(id?: string): string {
  if (!id) return '';
  return LEGACY_LUX_ID_MAP[id] || id;
}

export function getLuxReferenceById(id?: string): LuxLevelReference | undefined {
  if (!id) return undefined;
  const resolved = resolveLuxReferenceId(id);
  return IS_3646_LUX_REFERENCES.find((r) => r.id === resolved);
}

export type LightingFixtureKey =
  | 'tube20w'
  | 'tube40w'
  | 'surfaceLight36w'
  | 'recessLight20w'
  | 'recessLight36w'
  | 'bulbPoint20w';

export const LIGHTING_FIXTURE_KEYS: LightingFixtureKey[] = [
  'tube20w',
  'tube40w',
  'surfaceLight36w',
  'recessLight20w',
  'recessLight36w',
  'bulbPoint20w',
];

export const LIGHTING_FIXTURE_OPTIONS: { key: LightingFixtureKey; badgeId: string; label: string }[] = [
  { key: 'surfaceLight36w', badgeId: 'H07', label: '36W Surface Light' },
  { key: 'recessLight20w', badgeId: 'H08', label: '20W Recess Light' },
  { key: 'recessLight36w', badgeId: 'H09', label: '36W Recess Light' },
  { key: 'tube20w', badgeId: 'H05', label: '20W Tube' },
  { key: 'tube40w', badgeId: 'H06', label: '40W Tube' },
  { key: 'bulbPoint20w', badgeId: 'H15', label: '20W Bulb Point' },
];

export interface LuxCalculationSettings {
  utilizationFactor: number;
  maintenanceFactor: number;
  lumenPer20wTube: number;
  lumenPer40wTube: number;
  lumenPer36wSurface: number;
  lumenPer20wRecess: number;
  lumenPer36wRecess: number;
  lumenPer20wBulb: number;
  autoFillLightsFromLux: boolean;
  preferredFixtureKey: LightingFixtureKey;
}

export const DEFAULT_LUX_SETTINGS: LuxCalculationSettings = {
  utilizationFactor: 0.8,
  maintenanceFactor: 0.8,
  lumenPer20wTube: 2000,
  lumenPer40wTube: 4000,
  lumenPer36wSurface: 3600,
  lumenPer20wRecess: 2000,
  lumenPer36wRecess: 3600,
  lumenPer20wBulb: 2000,
  autoFillLightsFromLux: true,
  preferredFixtureKey: 'surfaceLight36w',
};

export interface RowLuxCalc {
  areaSqm: number;
  targetLux: number;
  rawLuxAreaLumens: number;
  requiredDesignLumens: number;
  installedLumens: number;
  achievedLux: number;
  luxGap: number;
  lumenGap: number;
  luxRefLabel: string;
}

function nLuxVal(v?: string): number {
  if (!v) return 0;
  const n = parseFloat(v);
  return isNaN(n) || n < 0 ? 0 : n;
}

export function getFixtureLumens(
  key: LightingFixtureKey,
  settings: LuxCalculationSettings
): number {
  switch (key) {
    case 'tube20w':
      return settings.lumenPer20wTube > 0 ? settings.lumenPer20wTube : 2000;
    case 'tube40w':
      return settings.lumenPer40wTube > 0 ? settings.lumenPer40wTube : 4000;
    case 'surfaceLight36w':
      return settings.lumenPer36wSurface > 0 ? settings.lumenPer36wSurface : 3600;
    case 'recessLight20w':
      return settings.lumenPer20wRecess > 0 ? settings.lumenPer20wRecess : 2000;
    case 'recessLight36w':
      return settings.lumenPer36wRecess > 0 ? settings.lumenPer36wRecess : 3600;
    case 'bulbPoint20w':
      return settings.lumenPer20wBulb > 0 ? settings.lumenPer20wBulb : 2000;
  }
}

export function computeRowLux(row: InventoryRow, settings: LuxCalculationSettings): RowLuxCalc {
  const sqmtVal = nLuxVal(row.sqmt);
  const sqftVal = nLuxVal(row.sqft);
  const areaSqm = sqmtVal > 0 ? sqmtVal : sqftVal > 0 ? sqftVal / 10.7639104 : 0;

  const ref = getLuxReferenceById(row.luxCategoryId);
  const overrideLux = nLuxVal(row.targetLux);
  const targetLux = overrideLux > 0 ? overrideLux : ref ? ref.recommendedLux : 0;

  const uf = settings.utilizationFactor > 0 ? settings.utilizationFactor : 0.8;
  const mf = settings.maintenanceFactor > 0 ? settings.maintenanceFactor : 0.8;

  const rawLuxAreaLumens = areaSqm * targetLux;
  const requiredDesignLumens = rawLuxAreaLumens > 0 ? rawLuxAreaLumens / (uf * mf) : 0;

  const installedLumens =
    nLuxVal(row.tube20w) * settings.lumenPer20wTube +
    nLuxVal(row.tube40w) * settings.lumenPer40wTube +
    nLuxVal(row.surfaceLight36w) * settings.lumenPer36wSurface +
    nLuxVal(row.recessLight20w) * settings.lumenPer20wRecess +
    nLuxVal(row.recessLight36w) * settings.lumenPer36wRecess +
    nLuxVal(row.bulbPoint20w) * settings.lumenPer20wBulb;

  const achievedLux = areaSqm > 0 ? (installedLumens * uf * mf) / areaSqm : 0;
  const luxGap = achievedLux - targetLux;
  const lumenGap = requiredDesignLumens - installedLumens;

  return {
    areaSqm,
    targetLux,
    rawLuxAreaLumens,
    requiredDesignLumens,
    installedLumens,
    achievedLux,
    luxGap,
    lumenGap,
    luxRefLabel: ref ? `${ref.slNo} ${ref.label} (${ref.luxDisplay} lx)` : 'Not selected',
  };
}

export function hasManualLightingValues(row: InventoryRow): boolean {
  if (row.luxAutoSynced) return false;
  return LIGHTING_FIXTURE_KEYS.some((k) => nLuxVal(row[k]) > 0);
}

export function applyLuxLightsToRow(
  row: InventoryRow,
  settings: LuxCalculationSettings,
  options?: { force?: boolean }
): InventoryRow {
  const force = Boolean(options?.force);
  if (!force && !settings.autoFillLightsFromLux) return row;
  if (!force && hasManualLightingValues(row)) return row;

  const sqmtVal = nLuxVal(row.sqmt);
  const sqftVal = nLuxVal(row.sqft);
  const areaSqm = sqmtVal > 0 ? sqmtVal : sqftVal > 0 ? sqftVal / 10.7639104 : 0;

  const ref = getLuxReferenceById(row.luxCategoryId);
  const overrideLux = nLuxVal(row.targetLux);
  const targetLux = overrideLux > 0 ? overrideLux : ref ? ref.recommendedLux : 0;

  const clearedLights: Pick<InventoryRow, LightingFixtureKey> = {
    tube20w: '',
    tube40w: '',
    surfaceLight36w: '',
    recessLight20w: '',
    recessLight36w: '',
    bulbPoint20w: '',
  };

  if (areaSqm <= 0 || targetLux <= 0) {
    if (row.luxAutoSynced || force) {
      return {
        ...row,
        ...clearedLights,
        luxAutoSynced: Boolean(ref),
      };
    }
    return row;
  }

  const uf = settings.utilizationFactor > 0 ? settings.utilizationFactor : 0.8;
  const mf = settings.maintenanceFactor > 0 ? settings.maintenanceFactor : 0.8;
  const requiredDesignLumens = (areaSqm * targetLux) / (uf * mf);
  const fixtureKey: LightingFixtureKey = settings.preferredFixtureKey || 'surfaceLight36w';
  const fixtureLumens = getFixtureLumens(fixtureKey, settings);
  const qty = Math.max(1, Math.ceil(requiredDesignLumens / fixtureLumens));

  return {
    ...row,
    ...clearedLights,
    [fixtureKey]: String(qty),
    luxAutoSynced: true,
  };
}

