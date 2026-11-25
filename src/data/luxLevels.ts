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
] as const;

export const IS_3646_LUX_REFERENCES: LuxLevelReference[] = [
  // 1. HOMES
  { id: 'home-kitchen', buildingGroup: '1. HOMES', slNo: '1(a)', label: 'Kitchen', luxDisplay: '200', minLux: 200, maxLux: 200, recommendedLux: 200 },
  { id: 'home-bathroom', buildingGroup: '1. HOMES', slNo: '1(b)', label: 'Bathroom', luxDisplay: '100*', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'home-stairs', buildingGroup: '1. HOMES', slNo: '1(c)', label: 'Stairs', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'home-garage', buildingGroup: '1. HOMES', slNo: '1(d)', label: 'Garage', luxDisplay: '70', minLux: 70, maxLux: 70, recommendedLux: 70 },
  { id: 'home-sewing-dining', buildingGroup: '1. HOMES', slNo: '1(e)', label: 'Sewing & Dining', luxDisplay: '700', minLux: 700, maxLux: 700, recommendedLux: 700 },
  { id: 'home-reading-casual', buildingGroup: '1. HOMES', slNo: '1(f)', label: 'Reading (Casual)', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'home-homework', buildingGroup: '1. HOMES', slNo: '1(g)', label: 'Homework & sustained reading', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },

  // 2. OFFICES
  { id: 'office-entrance', buildingGroup: '2. OFFICES', slNo: '2(a)', label: 'Entrance Hall & Reception', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'office-conference', buildingGroup: '2. OFFICES', slNo: '2(b)', label: 'Conference Room, Executive Office', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'office-general', buildingGroup: '2. OFFICES', slNo: '2(c)', label: 'General Office', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'office-business-machine', buildingGroup: '2. OFFICES', slNo: '2(d)', label: 'Business machine operation', luxDisplay: '450', minLux: 450, maxLux: 450, recommendedLux: 450 },
  { id: 'office-drawing-general', buildingGroup: '2. OFFICES', slNo: '2(e)', label: 'Drawing Office – General', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'office-drawing-boards', buildingGroup: '2. OFFICES', slNo: '2(e)', label: 'Drawing Office – Boards & Tracing', luxDisplay: '450', minLux: 450, maxLux: 450, recommendedLux: 450 },
  { id: 'office-corridor-lift', buildingGroup: '2. OFFICES', slNo: '2(f)', label: 'Corridor & Lift Cage', luxDisplay: '70', minLux: 70, maxLux: 70, recommendedLux: 70 },
  { id: 'office-stairs', buildingGroup: '2. OFFICES', slNo: '2(g)', label: 'Stairs', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'office-lift-landing', buildingGroup: '2. OFFICES', slNo: '2(h)', label: 'Lift Landing', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'office-tel-manual', buildingGroup: '2. OFFICES', slNo: '2(i)', label: 'Telephone Exchange – Manual Exchange (on desk)', luxDisplay: '200#', minLux: 200, maxLux: 200, recommendedLux: 200 },
  { id: 'office-tel-mdf', buildingGroup: '2. OFFICES', slNo: '2(i)', label: 'Telephone Exchange – Main Distribution Frame room', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },

  // 3. SCHOOLS & COLLEGES
  { id: 'school-assembly-central', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '3(a)', label: 'Assembly Hall – Central', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'school-assembly-exam', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '3(a)', label: 'Assembly Hall – When used for examination', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'school-assembly-platforms', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '3(a)', label: 'Assembly Hall – Platforms', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'school-class-desks', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '3(b)', label: 'Class & Lecture rooms – Desks', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'school-class-chalkboards', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '3(b)', label: 'Class & Lecture rooms – Chalk Boards', luxDisplay: '200-300**', minLux: 200, maxLux: 300, recommendedLux: 250 },
  { id: 'school-embroidery-sewing', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '3(c)', label: 'Embroidery & Sewing room', luxDisplay: '700', minLux: 700, maxLux: 700, recommendedLux: 700 },
  { id: 'school-art-room', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '3(d)', label: 'Art room', luxDisplay: '450', minLux: 450, maxLux: 450, recommendedLux: 450 },
  { id: 'school-laboratory', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '3(e)', label: 'Laboratory', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'school-library-shelves', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '3(f)', label: 'Library – Shelves, Stacks', luxDisplay: '70-150$', minLux: 70, maxLux: 150, recommendedLux: 110 },
  { id: 'school-library-reading', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '3(f)', label: 'Library – Reading Tables', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'school-offices', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '3(g)', label: 'Offices', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'school-staff-room', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '3(h)', label: 'Staff room, Common room', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'school-corridor', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '3(i)', label: 'Corridor', luxDisplay: '70', minLux: 70, maxLux: 70, recommendedLux: 70 },
  { id: 'school-stairs', buildingGroup: '3. SCHOOLS & COLLEGES', slNo: '3(j)', label: 'Stairs', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },

  // 4. HOSPITALS
  { id: 'hospital-reception', buildingGroup: '4. HOSPITALS', slNo: '4(a)', label: 'Reception & Waiting room', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'hospital-wards-general', buildingGroup: '4. HOSPITALS', slNo: '4(b)', label: 'Wards – General', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'hospital-wards-beds', buildingGroup: '4. HOSPITALS', slNo: '4(b)', label: 'Wards – Beds', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'hospital-ot-general', buildingGroup: '4. HOSPITALS', slNo: '4(c)', label: 'Operation Theatres – General', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'hospital-ot-tables', buildingGroup: '4. HOSPITALS', slNo: '4(c)', label: 'Operation Theatres – Tables', luxDisplay: 'Special Lighting', minLux: 1000, maxLux: 1000, recommendedLux: 1000, isSpecialLighting: true },
  { id: 'hospital-laboratories', buildingGroup: '4. HOSPITALS', slNo: '4(d)', label: 'Laboratories', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },
  { id: 'hospital-radiology', buildingGroup: '4. HOSPITALS', slNo: '4(e)', label: 'Radiology Department', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'hospital-casualty-opd', buildingGroup: '4. HOSPITALS', slNo: '4(f)', label: 'Casualty & Out Patient Department', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'hospital-stairs-corridors', buildingGroup: '4. HOSPITALS', slNo: '4(g)', label: 'Stairs, Corridors', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'hospital-dispensaries', buildingGroup: '4. HOSPITALS', slNo: '4(h)', label: 'Dispensaries', luxDisplay: '300', minLux: 300, maxLux: 300, recommendedLux: 300 },

  // 5. DAIRIES
  { id: 'dairy-general', buildingGroup: '5. DAIRIES', slNo: '5(a)', label: 'General working areas', luxDisplay: '200%', minLux: 200, maxLux: 200, recommendedLux: 200 },
  { id: 'dairy-bottle-inspection', buildingGroup: '5. DAIRIES', slNo: '5(b)', label: 'Bottle inspection', luxDisplay: 'Special Lighting', minLux: 500, maxLux: 500, recommendedLux: 500, isSpecialLighting: true },
  { id: 'dairy-bottle-filling', buildingGroup: '5. DAIRIES', slNo: '5(c)', label: 'Bottle Filling', luxDisplay: '450', minLux: 450, maxLux: 450, recommendedLux: 450 },

  // 6. SUB-STATION
  { id: 'substation-switchroom', buildingGroup: '6. SUB-STATION', slNo: '6(a)', label: 'Transformer, HT & LT Switch room', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
  { id: 'substation-control', buildingGroup: '6. SUB-STATION', slNo: '6(b)', label: 'Control Rooms', luxDisplay: '200-300', minLux: 200, maxLux: 300, recommendedLux: 250 },

  // 7. CINEMA / THEATRE
  { id: 'cinema-foyers', buildingGroup: '7. CINEMA / THEATRE', slNo: '7(a)', label: 'Foyers', luxDisplay: '150', minLux: 150, maxLux: 150, recommendedLux: 150 },
  { id: 'cinema-auditorium', buildingGroup: '7. CINEMA / THEATRE', slNo: '7(b)', label: 'Auditorium', luxDisplay: '50-70', minLux: 50, maxLux: 70, recommendedLux: 60 },
  { id: 'cinema-corridors', buildingGroup: '7. CINEMA / THEATRE', slNo: '7(c)', label: 'Corridors', luxDisplay: '70', minLux: 70, maxLux: 70, recommendedLux: 70 },
  { id: 'cinema-stairs', buildingGroup: '7. CINEMA / THEATRE', slNo: '7(d)', label: 'Stairs', luxDisplay: '100', minLux: 100, maxLux: 100, recommendedLux: 100 },
];

export function getLuxReferenceById(id?: string): LuxLevelReference | undefined {
  if (!id) return undefined;
  return IS_3646_LUX_REFERENCES.find((r) => r.id === id);
}
