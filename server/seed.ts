import { db, inTransaction } from './db.ts';
import { hashPassword } from './auth.ts';

const DRSI = 'https://www.drsc.si/kamere';
const DARS = 'https://kamere.dars.si/kamere';

interface CameraSeed {
  code: string;
  name: string;
  road_code: string;
  road_type: string;
  region: string;
  direction: string;
  lat: number;
  lng: number;
  image_url: string;
  operator: string;
  speed_limit_kmh: number;
  current_speed_kmh: number;
  traffic_flow: string;
  surface: string;
  temp_c: number;
  elevation_m: number;
}

const CAMERAS: CameraSeed[] = [
  { code: 'BLED', name: 'Bled — vzhod', road_code: 'G80', road_type: 'regional', region: 'Gorenjska', direction: 'proti Lescam', lat: 46.361, lng: 14.094, image_url: `${DRSI}/Bled/Bld1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 82, traffic_flow: 'smooth', surface: 'suho', temp_c: 6.5, elevation_m: 475 },
  { code: 'BREZOVICA-AC', name: 'Brezovica — avtocesta', road_code: 'A1', road_type: 'motorway', region: 'Osrednjeslovenska', direction: 'smer Ljubljana', lat: 45.935, lng: 14.375, image_url: `${DRSI}/BrezovicaAC/Bac1_0001.jpg`, operator: 'DRSI / DARS', speed_limit_kmh: 130, current_speed_kmh: 118, traffic_flow: 'smooth', surface: 'suho', temp_c: 8.0, elevation_m: 310 },
  { code: 'MARIBOR1', name: 'Maribor — vzhod', road_code: 'A1', road_type: 'motorway', region: 'Podravska', direction: 'smer Maribor', lat: 46.554, lng: 15.645, image_url: `${DRSI}/Maribor1/Mrb1_0001.jpg`, operator: 'DRSI / DARS', speed_limit_kmh: 130, current_speed_kmh: 124, traffic_flow: 'smooth', surface: 'suho', temp_c: 7.0, elevation_m: 260 },
  { code: 'KOPER1', name: 'Koper — vhod', road_code: 'H6', road_type: 'expressway', region: 'Primorska', direction: 'smer Koper', lat: 45.545, lng: 13.730, image_url: `${DRSI}/Koper1/Kpc1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 100, current_speed_kmh: 88, traffic_flow: 'smooth', surface: 'suho', temp_c: 11.0, elevation_m: 15 },
  { code: 'POSTOJNA-AC', name: 'Postojna — avtocesta', road_code: 'A1', road_type: 'motorway', region: 'Notranjsko-kraška', direction: 'smer Ljubljana', lat: 45.775, lng: 14.203, image_url: `${DRSI}/PostojnaAC/PAC1_0001.jpg`, operator: 'DRSI / DARS', speed_limit_kmh: 130, current_speed_kmh: 96, traffic_flow: 'busy', surface: 'suho', temp_c: 5.5, elevation_m: 540 },
  { code: 'LJUBELJ', name: 'Ljubelj — predor', road_code: 'G9', road_type: 'regional', region: 'Koroška', direction: 'smer Avstrija', lat: 46.426, lng: 14.309, image_url: `${DRSI}/Ljubelj/Lju1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 74, traffic_flow: 'smooth', surface: 'mokro', temp_c: 3.0, elevation_m: 1063 },
  { code: 'SENTILJ', name: 'Šentilj — mejni prehod', road_code: 'A1', road_type: 'motorway', region: 'Podravska', direction: 'smer Avstrija', lat: 46.678, lng: 15.660, image_url: `${DRSI}/Sentilj/Sen1_0001.jpg`, operator: 'DRSI / DARS', speed_limit_kmh: 130, current_speed_kmh: 110, traffic_flow: 'smooth', surface: 'suho', temp_c: 6.0, elevation_m: 290 },
  { code: 'CRNI-KAL', name: 'Črni Kal — viadukt', road_code: 'A1', road_type: 'motorway', region: 'Primorska', direction: 'smer Koper', lat: 45.552, lng: 13.910, image_url: `${DRSI}/CrniKal/Crn1_0001.jpg`, operator: 'DRSI / DARS', speed_limit_kmh: 130, current_speed_kmh: 121, traffic_flow: 'smooth', surface: 'suho', temp_c: 10.0, elevation_m: 180 },
  { code: 'RAZDRTO', name: 'Razdrto — križišče', road_code: 'A1', road_type: 'motorway', region: 'Notranjsko-kraška', direction: 'smer Postojna', lat: 45.750, lng: 14.050, image_url: `${DRSI}/Razdrto/Raz1_0001.jpg`, operator: 'DRSI / DARS', speed_limit_kmh: 130, current_speed_kmh: 102, traffic_flow: 'busy', surface: 'suho', temp_c: 6.0, elevation_m: 560 },
  { code: 'RAVBARKOMANDA', name: 'Ravbarkomanda — predor', road_code: 'A1', road_type: 'motorway', region: 'Notranjsko-kraška', direction: 'smer Ljubljana', lat: 45.770, lng: 14.180, image_url: `${DRSI}/Ravbarkomanda/Rav1_0001.jpg`, operator: 'DRSI / DARS', speed_limit_kmh: 130, current_speed_kmh: 98, traffic_flow: 'busy', surface: 'suho', temp_c: 5.0, elevation_m: 620 },
  { code: 'KRANJSKA-GORA1', name: 'Kranjska Gora — vhod', road_code: 'G2', road_type: 'regional', region: 'Gorenjska', direction: 'smer Rateče', lat: 46.480, lng: 13.785, image_url: `${DRSI}/KranjskaGora1/Krg1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 78, traffic_flow: 'smooth', surface: 'suho', temp_c: 2.0, elevation_m: 800 },
  { code: 'LENDAVA', name: 'Lendava — center', road_code: 'G3', road_type: 'regional', region: 'Pomurska', direction: 'smer Dolga vas', lat: 46.560, lng: 16.450, image_url: `${DRSI}/Lendava/Len1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 50, current_speed_kmh: 42, traffic_flow: 'smooth', surface: 'suho', temp_c: 7.5, elevation_m: 160 },
  { code: 'TREBNJE', name: 'Trebnje — avtocesta', road_code: 'A2', road_type: 'motorway', region: 'Jugovzhodna Slovenija', direction: 'smer Ljubljana', lat: 45.910, lng: 14.990, image_url: `${DRSI}/Trebnje/Tre1_0001.jpg`, operator: 'DRSI / DARS', speed_limit_kmh: 130, current_speed_kmh: 122, traffic_flow: 'smooth', surface: 'suho', temp_c: 8.5, elevation_m: 280 },
  { code: 'KRSKO1', name: 'Krško — avtocesta', road_code: 'A2', road_type: 'motorway', region: 'Posavska', direction: 'smer Zagreb', lat: 45.960, lng: 15.480, image_url: `${DRSI}/Krsko1/Krs1_0001.jpg`, operator: 'DRSI / DARS', speed_limit_kmh: 130, current_speed_kmh: 126, traffic_flow: 'smooth', surface: 'suho', temp_c: 9.0, elevation_m: 170 },
  { code: 'LUKOVICA', name: 'Lukovica — avtocesta', road_code: 'A2', road_type: 'motorway', region: 'Osrednjeslovenska', direction: 'smer Ljubljana', lat: 46.170, lng: 14.690, image_url: `${DRSI}/Lukovica/Luk1_0001.jpg`, operator: 'DRSI / DARS', speed_limit_kmh: 130, current_speed_kmh: 115, traffic_flow: 'smooth', surface: 'suho', temp_c: 7.0, elevation_m: 400 },
  { code: 'MEDVODE', name: 'Medvode — regionalna', road_code: 'G2', road_type: 'regional', region: 'Osrednjeslovenska', direction: 'smer Ljubljana', lat: 46.160, lng: 14.410, image_url: `${DRSI}/Medvode/Med1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 68, traffic_flow: 'busy', surface: 'suho', temp_c: 7.5, elevation_m: 320 },
  { code: 'PTUJ', name: 'Ptuj — regionalna', road_code: 'G2', road_type: 'regional', region: 'Podravska', direction: 'smer Ptuj', lat: 46.420, lng: 15.870, image_url: `${DRSI}/Ptuj/Ptp1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 80, traffic_flow: 'smooth', surface: 'suho', temp_c: 7.0, elevation_m: 260 },
  { code: 'TRBOVLJE', name: 'Trbovlje — regionalna', road_code: 'G2', road_type: 'regional', region: 'Zasavska', direction: 'smer Trbovlje', lat: 46.120, lng: 15.050, image_url: `${DRSI}/Trbovlje/Trb1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 72, traffic_flow: 'smooth', surface: 'mokro', temp_c: 6.0, elevation_m: 280 },
  { code: 'SOLKAN', name: 'Solkan — most', road_code: 'G4', road_type: 'regional', region: 'Goriška', direction: 'smer Nova Gorica', lat: 45.990, lng: 13.650, image_url: `${DRSI}/Solkan/Sol1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 70, current_speed_kmh: 55, traffic_flow: 'busy', surface: 'suho', temp_c: 9.0, elevation_m: 90 },
  { code: 'VALETA', name: 'Valeta — regionalna', road_code: 'G11', road_type: 'regional', region: 'Primorska', direction: 'smer Izola', lat: 45.530, lng: 13.640, image_url: `${DRSI}/Valeta/Val1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 84, traffic_flow: 'smooth', surface: 'suho', temp_c: 11.5, elevation_m: 40 },
  { code: 'MISLINJA', name: 'Mislinja — regionalna', road_code: 'G11', road_type: 'regional', region: 'Koroška', direction: 'smer Slovenj Gradec', lat: 46.440, lng: 15.020, image_url: `${DRSI}/Mislinja/Mis1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 76, traffic_flow: 'smooth', surface: 'suho', temp_c: 5.0, elevation_m: 450 },
  { code: 'TRZIN', name: 'Trzin — regionalna', road_code: 'G2', road_type: 'regional', region: 'Osrednjeslovenska', direction: 'smer Domžale', lat: 46.140, lng: 14.560, image_url: `${DRSI}/Trzin/Trz1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 70, traffic_flow: 'busy', surface: 'suho', temp_c: 8.0, elevation_m: 310 },
  { code: 'SKOFLJICA', name: 'Škofljica — regionalna', road_code: 'G2', road_type: 'regional', region: 'Osrednjeslovenska', direction: 'smer Ljubljana', lat: 45.990, lng: 14.530, image_url: `${DRSI}/Skofljica/Sko1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 66, traffic_flow: 'busy', surface: 'suho', temp_c: 8.5, elevation_m: 300 },
  { code: 'FRAM', name: 'Fram — avtocesta', road_code: 'A1', road_type: 'motorway', region: 'Podravska', direction: 'smer Maribor', lat: 46.490, lng: 15.600, image_url: `${DRSI}/Fram/Fra1_0001.jpg`, operator: 'DRSI / DARS', speed_limit_kmh: 130, current_speed_kmh: 119, traffic_flow: 'smooth', surface: 'suho', temp_c: 6.5, elevation_m: 300 },
  { code: 'VIPAVA', name: 'Vipava — regionalna', road_code: 'G4', road_type: 'regional', region: 'Goriška', direction: 'smer Ajdovščina', lat: 45.850, lng: 13.960, image_url: `${DRSI}/Vipava/Vip1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 82, traffic_flow: 'smooth', surface: 'suho', temp_c: 8.0, elevation_m: 100 },
  { code: 'LOGATEC', name: 'Logatec — regionalna', road_code: 'G2', road_type: 'regional', region: 'Osrednjeslovenska', direction: 'smer Logatec', lat: 45.920, lng: 14.230, image_url: `${DRSI}/Logatec/Lgt1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 74, traffic_flow: 'busy', surface: 'suho', temp_c: 6.0, elevation_m: 480 },
  { code: 'VODICE', name: 'Vodice — regionalna', road_code: 'G2', road_type: 'regional', region: 'Osrednjeslovenska', direction: 'smer Vodice', lat: 46.180, lng: 14.290, image_url: `${DRSI}/Vodice/Vod1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 79, traffic_flow: 'smooth', surface: 'suho', temp_c: 7.0, elevation_m: 330 },
  { code: 'METLIKA', name: 'Metlika — regionalna', road_code: 'G105', road_type: 'regional', region: 'Jugovzhodna Slovenija', direction: 'smer Metlika', lat: 45.650, lng: 15.250, image_url: `${DRSI}/Metlika/Met1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 81, traffic_flow: 'smooth', surface: 'suho', temp_c: 8.0, elevation_m: 180 },
  { code: 'DRAGONJA', name: 'Dragonja — regionalna', road_code: 'G5', road_type: 'regional', region: 'Primorska', direction: 'smer Dragonja', lat: 45.470, lng: 13.660, image_url: `${DRSI}/Dragonja/Dra1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 77, traffic_flow: 'smooth', surface: 'suho', temp_c: 10.5, elevation_m: 60 },
  { code: 'PREDEL', name: 'Predel — gorski prelaz', road_code: 'G17', road_type: 'regional', region: 'Gorenjska', direction: 'smer Predil', lat: 46.440, lng: 13.590, image_url: `${DRSI}/Predel/Pre1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 62, traffic_flow: 'smooth', surface: 'mokro', temp_c: 1.0, elevation_m: 1155 },
  { code: 'VIC', name: 'Vič — Ljubljana', road_code: 'G2', road_type: 'regional', region: 'Osrednjeslovenska', direction: 'smer Vič', lat: 46.040, lng: 14.470, image_url: `${DRSI}/Vic/Vic1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 50, current_speed_kmh: 38, traffic_flow: 'busy', surface: 'suho', temp_c: 8.0, elevation_m: 300 },
  { code: 'SENTRUPERT', name: 'Šentrupert — regionalna', road_code: 'G2', road_type: 'regional', region: 'Posavska', direction: 'smer Šentrupert', lat: 45.980, lng: 15.090, image_url: `${DRSI}/Sentrupert/Str1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 83, traffic_flow: 'smooth', surface: 'suho', temp_c: 8.0, elevation_m: 250 },
  { code: 'SPODNJE-STRANICE', name: 'Spodnje Stranice — regionalna', road_code: 'G2', road_type: 'regional', region: 'Jugovzhodna Slovenija', direction: 'smer Stranice', lat: 45.800, lng: 15.050, image_url: `${DRSI}/SpodnjeStranice/Sst1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 85, traffic_flow: 'smooth', surface: 'suho', temp_c: 7.0, elevation_m: 350 },
  { code: 'KOZINA', name: 'Kozina — regionalna', road_code: 'G7', road_type: 'regional', region: 'Primorska', direction: 'smer Kozina', lat: 45.610, lng: 13.930, image_url: `${DRSI}/Kozina/Koz1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 80, traffic_flow: 'smooth', surface: 'suho', temp_c: 9.0, elevation_m: 450 },
  { code: 'BOHINJSKA', name: 'Bohinjska Bistrica — regionalna', road_code: 'G2', road_type: 'regional', region: 'Gorenjska', direction: 'smer Bohinj', lat: 46.270, lng: 13.920, image_url: `${DRSI}/Bohinjska/Boh1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 71, traffic_flow: 'smooth', surface: 'suho', temp_c: 3.5, elevation_m: 520 },
  { code: 'HODOS', name: 'Hodoš — mejni prehod', road_code: 'G3', road_type: 'regional', region: 'Pomurska', direction: 'smer Hodoš', lat: 46.820, lng: 16.340, image_url: `${DRSI}/Hodos/Hod1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 86, traffic_flow: 'smooth', surface: 'suho', temp_c: 7.0, elevation_m: 230 },
  { code: 'CRNIVEC', name: 'Crnivec — gorski prelaz', road_code: 'G2', road_type: 'regional', region: 'Savinjska', direction: 'smer Crnivec', lat: 46.280, lng: 14.680, image_url: `${DRSI}/Crnivec/Crn1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 64, traffic_flow: 'smooth', surface: 'mokro', temp_c: 2.5, elevation_m: 880 },
  { code: 'DOVJE', name: 'Dovje — regionalna', road_code: 'G2', road_type: 'regional', region: 'Gorenjska', direction: 'smer Dovje', lat: 46.500, lng: 13.960, image_url: `${DRSI}/Dovje/Dov1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 75, traffic_flow: 'smooth', surface: 'suho', temp_c: 4.0, elevation_m: 700 },
  { code: 'KRANJ', name: 'Kranj — regionalna', road_code: 'G2', road_type: 'regional', region: 'Gorenjska', direction: 'smer Kranj', lat: 46.240, lng: 14.360, image_url: `${DRSI}/Kranj/Kra1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 69, traffic_flow: 'busy', surface: 'suho', temp_c: 7.0, elevation_m: 420 },
  { code: 'VRHNIKA', name: 'Vrhnika — regionalna', road_code: 'G2', road_type: 'regional', region: 'Osrednjeslovenska', direction: 'smer Vrhnika', lat: 45.960, lng: 14.290, image_url: `${DRSI}/Vrhnika/Vrh1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 73, traffic_flow: 'busy', surface: 'suho', temp_c: 6.5, elevation_m: 300 },
  { code: 'JESENICE', name: 'Jesenice — regionalna', road_code: 'G2', road_type: 'regional', region: 'Gorenjska', direction: 'smer Jesenice', lat: 46.430, lng: 14.050, image_url: `${DRSI}/Jesenice/Jes1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 78, traffic_flow: 'smooth', surface: 'suho', temp_c: 5.0, elevation_m: 430 },
  { code: 'DIVACA', name: 'Divača — regionalna', road_code: 'G7', road_type: 'regional', region: 'Primorska', direction: 'smer Divača', lat: 45.680, lng: 13.970, image_url: `${DRSI}/Divaca/Div1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 84, traffic_flow: 'smooth', surface: 'suho', temp_c: 8.5, elevation_m: 440 },
  { code: 'VAHTA', name: 'Vahta — regionalna', road_code: 'G2', road_type: 'regional', region: 'Posavska', direction: 'smer Vahta', lat: 45.880, lng: 15.420, image_url: `${DRSI}/Vahta/Vah1_0001.jpg`, operator: 'DRSI', speed_limit_kmh: 90, current_speed_kmh: 87, traffic_flow: 'smooth', surface: 'suho', temp_c: 8.0, elevation_m: 200 },
  { code: 'DARS-BOSTANJ', name: 'Boštanj — avtocesta', road_code: 'A2', road_type: 'motorway', region: 'Posavska', direction: 'smer Novo mesto', lat: 45.990, lng: 15.280, image_url: `${DARS}/drsi_vgrc/Bostanj_Bos1_0001.jpg`, operator: 'DARS', speed_limit_kmh: 130, current_speed_kmh: 121, traffic_flow: 'smooth', surface: 'suho', temp_c: 8.5, elevation_m: 190 },
  { code: 'DARS-BREZOVICA', name: 'Brezovica — avtocesta (DARS)', road_code: 'A1', road_type: 'motorway', region: 'Osrednjeslovenska', direction: 'smer Ljubljana', lat: 45.930, lng: 14.380, image_url: `${DARS}/drsi_vgrc/BrezovicaAC_Bac1_0001.jpg`, operator: 'DARS', speed_limit_kmh: 130, current_speed_kmh: 117, traffic_flow: 'smooth', surface: 'suho', temp_c: 8.0, elevation_m: 310 },
  { code: 'DARS-DRNOVO-ZG', name: 'Drnovo — smer Zagreb', road_code: 'A2', road_type: 'motorway', region: 'Posavska', direction: 'smer Zagreb', lat: 45.820, lng: 15.150, image_url: `${DARS}/Drnovo/K7_Krska_vas_smer_Zg.jpg`, operator: 'DARS', speed_limit_kmh: 130, current_speed_kmh: 125, traffic_flow: 'smooth', surface: 'suho', temp_c: 9.0, elevation_m: 160 },
  { code: 'DARS-DRNOVO-NM', name: 'Drnovo — smer Novo mesto', road_code: 'A2', road_type: 'motorway', region: 'Posavska', direction: 'smer Novo mesto', lat: 45.820, lng: 15.150, image_url: `${DARS}/Drnovo/K6_Krska_vas_smer_Nm.jpg`, operator: 'DARS', speed_limit_kmh: 130, current_speed_kmh: 123, traffic_flow: 'smooth', surface: 'suho', temp_c: 9.0, elevation_m: 160 },
  { code: 'DARS-NOVO-MESTO', name: 'Novo mesto — Obrezje', road_code: 'A2', road_type: 'motorway', region: 'Jugovzhodna Slovenija', direction: 'smer Novo mesto', lat: 45.800, lng: 15.170, image_url: `${DARS}/Novo_mesto/Obrezje.jpg`, operator: 'DARS', speed_limit_kmh: 130, current_speed_kmh: 120, traffic_flow: 'smooth', surface: 'suho', temp_c: 8.5, elevation_m: 200 },
  { code: 'DARS-KOZINA', name: 'Kozina — Dilce', road_code: 'A1', road_type: 'motorway', region: 'Primorska', direction: 'smer Koper', lat: 45.610, lng: 13.930, image_url: `${DARS}/Kozina/Dilce_2.jpg`, operator: 'DARS', speed_limit_kmh: 130, current_speed_kmh: 114, traffic_flow: 'smooth', surface: 'suho', temp_c: 9.0, elevation_m: 450 },
  { code: 'DARS-MARIBOR', name: 'Maribor — Dolga vas', road_code: 'A1', road_type: 'motorway', region: 'Podravska', direction: 'smer Maribor', lat: 46.540, lng: 15.640, image_url: `${DARS}/Maribor/IP_30_L13.1_Dolga_vas.jpg`, operator: 'DARS', speed_limit_kmh: 130, current_speed_kmh: 122, traffic_flow: 'smooth', surface: 'suho', temp_c: 7.0, elevation_m: 260 },
  { code: 'DARS-TOROVO-KR', name: 'Torovo — smer Kranj', road_code: 'A2', road_type: 'motorway', region: 'Gorenjska', direction: 'smer Kranj', lat: 46.230, lng: 14.360, image_url: `${DARS}/Torovo/SD_Torovo_KR.jpg`, operator: 'DARS', speed_limit_kmh: 130, current_speed_kmh: 108, traffic_flow: 'busy', surface: 'suho', temp_c: 7.0, elevation_m: 420 },
  { code: 'DARS-TOROVO-LJ', name: 'Torovo — smer Ljubljana', road_code: 'A2', road_type: 'motorway', region: 'Gorenjska', direction: 'smer Ljubljana', lat: 46.230, lng: 14.360, image_url: `${DARS}/Torovo/SD_Torovo_LJ.jpg`, operator: 'DARS', speed_limit_kmh: 130, current_speed_kmh: 106, traffic_flow: 'busy', surface: 'suho', temp_c: 7.0, elevation_m: 420 },
  { code: 'DARS-LJUBLJANA', name: 'Ljubljana — Brezovica', road_code: 'A1', road_type: 'motorway', region: 'Osrednjeslovenska', direction: 'smer Ljubljana', lat: 45.940, lng: 14.380, image_url: `${DARS}/ljubljana/K01_Brezovica_Po.jpg`, operator: 'DARS', speed_limit_kmh: 130, current_speed_kmh: 116, traffic_flow: 'smooth', surface: 'suho', temp_c: 8.0, elevation_m: 310 },
];

interface SegmentSeed {
  code: string;
  name: string;
  corridor: string;
  region: string;
  road_type: string;
  length_km: number;
  speed_limit_kmh: number;
  avg_speed_kmh: number;
  density_pct: number;
  flow_status: string;
  surface: string;
  temp_c: number;
  wind_kmh: number;
  delay_min: number;
  note: string;
  polyline_key: string;
}

const SEGMENTS: SegmentSeed[] = [
  { code: 'A1-LJ-MB', name: 'A1 Ljubljana – Maribor', corridor: 'A1', region: 'Osrednjeslovenska', road_type: 'motorway', length_km: 127, speed_limit_kmh: 130, avg_speed_kmh: 118, density_pct: 42, flow_status: 'smooth', surface: 'suho', temp_c: 8.0, wind_kmh: 12, delay_min: 0, note: 'Gostota normalna, brez ovir.', polyline_key: 'a1-lj-mb' },
  { code: 'A1-LJ-KP', name: 'A1 Ljubljana – Koper', corridor: 'A1', region: 'Primorska', road_type: 'motorway', length_km: 95, speed_limit_kmh: 130, avg_speed_kmh: 102, density_pct: 61, flow_status: 'busy', surface: 'suho', temp_c: 9.5, wind_kmh: 18, delay_min: 4, note: 'Povečana gostota pri Razdrtem in Ravbarkomandi.', polyline_key: 'a1-lj-kp' },
  { code: 'A2-LJ-KR', name: 'A2 Ljubljana – Kranj', corridor: 'A2', region: 'Gorenjska', road_type: 'motorway', length_km: 28, speed_limit_kmh: 130, avg_speed_kmh: 108, density_pct: 58, flow_status: 'busy', surface: 'suho', temp_c: 7.0, wind_kmh: 10, delay_min: 3, note: 'Zastoj pri Torovem v smeri Kranj.', polyline_key: 'a2-lj-kr' },
  { code: 'A2-LJ-NM', name: 'A2 Ljubljana – Novo mesto', corridor: 'A2', region: 'Jugovzhodna Slovenija', road_type: 'motorway', length_km: 72, speed_limit_kmh: 130, avg_speed_kmh: 121, density_pct: 38, flow_status: 'smooth', surface: 'suho', temp_c: 8.5, wind_kmh: 8, delay_min: 0, note: 'Prost pretok, suho vozišče.', polyline_key: 'a2-lj-nm' },
  { code: 'A2-NM-ZG', name: 'A2 Novo mesto – Zagreb', corridor: 'A2', region: 'Posavska', road_type: 'motorway', length_km: 55, speed_limit_kmh: 130, avg_speed_kmh: 124, density_pct: 33, flow_status: 'smooth', surface: 'suho', temp_c: 9.0, wind_kmh: 9, delay_min: 0, note: 'Brez ovir, hitrost blizu omejitve.', polyline_key: 'a2-nm-zg' },
  { code: 'A4-MB-GR', name: 'A4 Maribor – Gruškovje', corridor: 'A4', region: 'Podravska', road_type: 'motorway', length_km: 20, speed_limit_kmh: 130, avg_speed_kmh: 119, density_pct: 40, flow_status: 'smooth', surface: 'suho', temp_c: 7.0, wind_kmh: 11, delay_min: 0, note: 'Normalen promet.', polyline_key: 'a4-mb-gr' },
  { code: 'A5-MB-LEN', name: 'A5 Maribor – Lendava', corridor: 'A5', region: 'Pomurska', road_type: 'motorway', length_km: 85, speed_limit_kmh: 130, avg_speed_kmh: 122, density_pct: 30, flow_status: 'smooth', surface: 'suho', temp_c: 7.5, wind_kmh: 13, delay_min: 0, note: 'Prost pretok čez Pomurje.', polyline_key: 'a5-mb-len' },
  { code: 'H3-LJ-VZ', name: 'H3 Ljubljana – vzhod', corridor: 'H3', region: 'Osrednjeslovenska', road_type: 'expressway', length_km: 10, speed_limit_kmh: 100, avg_speed_kmh: 74, density_pct: 72, flow_status: 'busy', surface: 'suho', temp_c: 8.0, wind_kmh: 6, delay_min: 6, note: 'Mestni zastoj v konici.', polyline_key: 'h3-lj-vz' },
  { code: 'H4-VR-NG', name: 'H4 Vrtojba – Nova Gorica', corridor: 'H4', region: 'Goriška', road_type: 'expressway', length_km: 20, speed_limit_kmh: 100, avg_speed_kmh: 92, density_pct: 45, flow_status: 'smooth', surface: 'suho', temp_c: 9.0, wind_kmh: 14, delay_min: 0, note: 'Brez zastojev.', polyline_key: 'h4-vr-ng' },
  { code: 'G2-LJ-KR', name: 'G2 Ljubljana – Kranj', corridor: 'G2', region: 'Gorenjska', road_type: 'regional', length_km: 27, speed_limit_kmh: 90, avg_speed_kmh: 68, density_pct: 66, flow_status: 'busy', surface: 'suho', temp_c: 7.0, wind_kmh: 7, delay_min: 5, note: 'Počasnejši promet skozi Medvode in Vodice.', polyline_key: 'g2-lj-kr' },
  { code: 'G9-LJ-JE', name: 'G9 Ljubljana – Jesenice', corridor: 'G9', region: 'Gorenjska', road_type: 'regional', length_km: 55, speed_limit_kmh: 90, avg_speed_kmh: 78, density_pct: 44, flow_status: 'smooth', surface: 'suho', temp_c: 5.0, wind_kmh: 10, delay_min: 0, note: 'Normalen promet proti Jesenicam.', polyline_key: 'g9-lj-je' },
  { code: 'G11-KP-IZ', name: 'G11 Koper – Izola', corridor: 'G11', region: 'Primorska', road_type: 'regional', length_km: 12, speed_limit_kmh: 90, avg_speed_kmh: 84, density_pct: 48, flow_status: 'smooth', surface: 'suho', temp_c: 11.0, wind_kmh: 16, delay_min: 0, note: 'Obalna cesta brez ovir.', polyline_key: 'g11-kp-iz' },
];

interface IncidentSeed {
  type: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  road_code: string;
  region: string;
  location_name: string;
  direction: string;
  lat: number;
  lng: number;
  delay_min: number;
  queue_km: number;
  speed_limit_kmh: number | null;
  measured_speed_kmh: number | null;
  minutes_ago: number;
  reporter_name: string;
}

const INCIDENTS: IncidentSeed[] = [
  { type: 'police', severity: 'medium', status: 'active', title: 'Policijska kontrola — merjenje hitrosti', description: 'Policisti merijo hitrost na regionalni cesti. Vozila ustavljajo v obeh smereh, priporočamo previdno vožnjo.', road_code: 'G2', region: 'Osrednjeslovenska', location_name: 'Medvode — regionalna cesta', direction: 'smer Ljubljana', lat: 46.160, lng: 14.410, delay_min: 3, queue_km: 0.4, speed_limit_kmh: 90, measured_speed_kmh: 112, minutes_ago: 8, reporter_name: 'Marko P.' },
  { type: 'accident', severity: 'high', status: 'active', title: 'Prometna nesreča — dva avtomobila', description: 'Trčenje dveh osebnih vozil, en vozni pas zaprt. Reševalci in policija na kraju, nastaja zastoj.', road_code: 'A1', region: 'Notranjsko-kraška', location_name: 'Razdrto — avtocesta A1', direction: 'smer Postojna', lat: 45.750, lng: 14.050, delay_min: 18, queue_km: 3.2, speed_limit_kmh: 130, measured_speed_kmh: null, minutes_ago: 22, reporter_name: 'Ana K.' },
  { type: 'jam', severity: 'medium', status: 'active', title: 'Zastoj — počasna vožnja', description: 'Gost promet in počasna vožnja v koloni. Priporočena obvozna pot čez regionalno cesto.', road_code: 'A2', region: 'Gorenjska', location_name: 'Torovo — avtocesta A2', direction: 'smer Kranj', lat: 46.230, lng: 14.360, delay_min: 12, queue_km: 2.1, speed_limit_kmh: 130, measured_speed_kmh: null, minutes_ago: 15, reporter_name: 'Jure Š.' },
  { type: 'police', severity: 'low', status: 'active', title: 'Policijski avtomobil ob cesti', description: 'Policijski avtomobil stoji ob robu ceste, patrulja opazuje promet. Brez ustavljanja.', road_code: 'A1', region: 'Primorska', location_name: 'Črni Kal — viadukt A1', direction: 'smer Koper', lat: 45.552, lng: 13.910, delay_min: 0, queue_km: 0, speed_limit_kmh: 130, measured_speed_kmh: null, minutes_ago: 31, reporter_name: 'Maja R.' },
  { type: 'roadwork', severity: 'low', status: 'active', title: 'Gradbena dela — zožena cesta', description: 'Vzdrževanje vozišča, zožena cesta in omejitev hitrosti na 60 km/h. Postavljena prometna signalizacija.', road_code: 'A1', region: 'Podravska', location_name: 'Fram — avtocesta A1', direction: 'smer Maribor', lat: 46.490, lng: 15.600, delay_min: 5, queue_km: 0.8, speed_limit_kmh: 60, measured_speed_kmh: null, minutes_ago: 120, reporter_name: 'DARS info' },
  { type: 'hazard', severity: 'medium', status: 'active', title: 'Nevarnost — mokro vozišče in megla', description: 'Na gorskem prelazu je mokro vozišče in megla z vidljivostjo pod 100 m. Vozite previdno in prižgite meglenke.', road_code: 'G2', region: 'Savinjska', location_name: 'Crnivec — gorski prelaz', direction: 'smer Crnivec', lat: 46.280, lng: 14.680, delay_min: 0, queue_km: 0, speed_limit_kmh: 90, measured_speed_kmh: null, minutes_ago: 45, reporter_name: 'Tomaž B.' },
  { type: 'police', severity: 'high', status: 'active', title: 'Policijska kontrola — alkohol in hitrost', description: 'Pojačana policijska kontrola, merjenje hitrosti in preverjanje dokumentov. Dolga kolona vozil.', road_code: 'A2', region: 'Osrednjeslovenska', location_name: 'Lukovica — avtocesta A2', direction: 'smer Ljubljana', lat: 46.170, lng: 14.690, delay_min: 8, queue_km: 1.5, speed_limit_kmh: 130, measured_speed_kmh: 145, minutes_ago: 12, reporter_name: 'Klemen D.' },
  { type: 'jam', severity: 'high', status: 'active', title: 'Močan zastoj — mestni promet', description: 'Zastoj v mestnem prometu v večerni konici. Kolona od Viča proti centru, zamuda do 20 minut.', road_code: 'G2', region: 'Osrednjeslovenska', location_name: 'Vič — Ljubljana', direction: 'smer center', lat: 46.040, lng: 14.470, delay_min: 20, queue_km: 2.8, speed_limit_kmh: 50, measured_speed_kmh: null, minutes_ago: 5, reporter_name: 'Sara L.' },
  { type: 'accident', severity: 'medium', status: 'active', title: 'Prometna nesreča — manjša škoda', description: 'Lažja prometna nesreča na regionalni cesti, vozili umaknjeni na rob. Promet poteka izmenično.', road_code: 'G2', region: 'Gorenjska', location_name: 'Kranj — regionalna cesta', direction: 'smer Kranj', lat: 46.240, lng: 14.360, delay_min: 6, queue_km: 0.6, speed_limit_kmh: 90, measured_speed_kmh: null, minutes_ago: 38, reporter_name: 'Luka V.' },
  { type: 'hazard', severity: 'low', status: 'active', title: 'Divjad na cesti — previdno', description: 'Poročilo o divjadi ob cesti. Vozite previdno, zlasti v mraku.', road_code: 'G2', region: 'Posavska', location_name: 'Vahta — regionalna cesta', direction: 'smer Vahta', lat: 45.880, lng: 15.420, delay_min: 0, queue_km: 0, speed_limit_kmh: 90, measured_speed_kmh: null, minutes_ago: 64, reporter_name: 'Petra N.' },
  { type: 'police', severity: 'medium', status: 'active', title: 'Merjenje hitrosti — radar', description: 'Stacionarni radar meri hitrost, v bližini tudi patrulja. Omejitev 90 km/h.', road_code: 'G2', region: 'Jugovzhodna Slovenija', location_name: 'Trebnje — avtocesta A2', direction: 'smer Ljubljana', lat: 45.910, lng: 14.990, delay_min: 0, queue_km: 0, speed_limit_kmh: 130, measured_speed_kmh: 138, minutes_ago: 19, reporter_name: 'Gregor M.' },
  { type: 'roadwork', severity: 'medium', status: 'active', title: 'Zapora vozišča — vzdrževanje', description: 'Delna zapora vozišča zaradi vzdrževanja, promet poteka po enem voznem pasu.', road_code: 'A1', region: 'Primorska', location_name: 'Kozina — avtocesta A1', direction: 'smer Koper', lat: 45.610, lng: 13.930, delay_min: 7, queue_km: 1.1, speed_limit_kmh: 80, measured_speed_kmh: null, minutes_ago: 180, reporter_name: 'DARS info' },
];

export function seedDatabase(): void {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number };
  if (userCount.c > 0) return;

  const now = new Date();
  const iso = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();

  inTransaction(() => {
    const demoHash = hashPassword('demo1234');
    const insertUser = db.prepare(
      `INSERT INTO users (name, email, password_hash, role, vehicle_name, vehicle_plate, speed_tolerance_kmh, home_region, audio_alerts, reputation, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const demo = insertUser.run(
      'Demo voznik',
      'demo@slopromet.si',
      demoHash,
      'driver',
      'Škoda Octavia RS',
      'LJ SP-2026',
      5,
      'Osrednjeslovenska',
      1,
      120,
      iso(60 * 24 * 30)
    );
    const demoId = Number(demo.lastInsertRowid);

    const insertCamera = db.prepare(
      `INSERT INTO cameras (code, name, road_code, road_type, region, direction, lat, lng, image_url, source_url, operator, status, speed_limit_kmh, current_speed_kmh, traffic_flow, surface, temp_c, elevation_m, created_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const cameraIds = new Map<string, number>();
    for (const cam of CAMERAS) {
      const result = insertCamera.run(
        cam.code,
        cam.name,
        cam.road_code,
        cam.road_type,
        cam.region,
        cam.direction,
        cam.lat,
        cam.lng,
        cam.image_url,
        'https://www.promet.si/sl/kamere',
        cam.operator,
        'online',
        cam.speed_limit_kmh,
        cam.current_speed_kmh,
        cam.traffic_flow,
        cam.surface,
        cam.temp_c,
        cam.elevation_m,
        demoId,
        iso(0)
      );
      cameraIds.set(cam.code, Number(result.lastInsertRowid));
    }

    const fav = db.prepare('INSERT OR IGNORE INTO camera_favorites (user_id, camera_id) VALUES (?, ?)');
    for (const code of ['BREZOVICA-AC', 'DARS-LJUBLJANA', 'MARIBOR1', 'KOPER1', 'CRNI-KAL', 'DARS-TOROVO-LJ']) {
      const id = cameraIds.get(code);
      if (id) fav.run(demoId, id);
    }

    const insertSegment = db.prepare(
      `INSERT INTO road_segments (code, name, corridor, region, road_type, length_km, speed_limit_kmh, avg_speed_kmh, density_pct, flow_status, surface, temp_c, wind_kmh, delay_min, note, polyline_key, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const seg of SEGMENTS) {
      insertSegment.run(
        seg.code,
        seg.name,
        seg.corridor,
        seg.region,
        seg.road_type,
        seg.length_km,
        seg.speed_limit_kmh,
        seg.avg_speed_kmh,
        seg.density_pct,
        seg.flow_status,
        seg.surface,
        seg.temp_c,
        seg.wind_kmh,
        seg.delay_min,
        seg.note,
        seg.polyline_key,
        demoId,
        iso(0)
      );
    }

    const insertIncident = db.prepare(
      `INSERT INTO incidents (type, severity, status, title, description, road_code, region, location_name, direction, lat, lng, delay_min, queue_km, speed_limit_kmh, measured_speed_kmh, confirmations, dismissals, reporter_id, reporter_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const inc of INCIDENTS) {
      insertIncident.run(
        inc.type,
        inc.severity,
        inc.status,
        inc.title,
        inc.description,
        inc.road_code,
        inc.region,
        inc.location_name,
        inc.direction,
        inc.lat,
        inc.lng,
        inc.delay_min,
        inc.queue_km,
        inc.speed_limit_kmh,
        inc.measured_speed_kmh,
        1 + Math.floor(Math.random() * 6),
        Math.floor(Math.random() * 2),
        demoId,
        inc.reporter_name,
        iso(inc.minutes_ago),
        iso(inc.minutes_ago)
      );
    }

    const insertRoute = db.prepare(
      `INSERT INTO saved_routes (user_id, name, origin_name, origin_lat, origin_lng, dest_name, dest_lat, dest_lng, via_roads, distance_km, base_duration_min, preset_key, notify_police, notify_accidents, notify_jams, is_pinned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertRoute.run(
      demoId,
      'Ljubljana → Maribor',
      'Ljubljana — center',
      46.0569,
      14.5058,
      'Maribor — center',
      46.5547,
      15.645,
      'A1',
      127,
      95,
      'lj-mb',
      1,
      1,
      1,
      1,
      iso(60 * 24 * 12),
      iso(60 * 24 * 12)
    );
    insertRoute.run(
      demoId,
      'Ljubljana → Koper',
      'Ljubljana — center',
      46.0569,
      14.5058,
      'Koper — pristanišče',
      45.545,
      13.73,
      'A1',
      105,
      85,
      'lj-kp',
      1,
      1,
      1,
      0,
      iso(60 * 24 * 8),
      iso(60 * 24 * 8)
    );
    insertRoute.run(
      demoId,
      'Ljubljana → Bled',
      'Ljubljana — center',
      46.0569,
      14.5058,
      'Bled — jezero',
      46.361,
      14.094,
      'A2, G2',
      55,
      50,
      'lj-bled',
      1,
      1,
      0,
      0,
      iso(60 * 24 * 5),
      iso(60 * 24 * 5)
    );

    console.log(`Seeded database: ${CAMERAS.length} cameras, ${SEGMENTS.length} segments, ${INCIDENTS.length} incidents, demo user #${demoId}`);
  });
}
