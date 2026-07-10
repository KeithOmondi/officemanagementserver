// src/seeders/seedStations.ts

import { pool } from "./config/db";
import { StationType } from "./features/stations/stations.types";

/* ============================================================
   SEED DATA – sourced from "High Court By county and Supervisory Jurisdiction" document
   Dated: Latest (includes updates up to 2025)
============================================================ */

interface StationSeed {
  name: string;
  type: StationType;
  location: string | null;
  county?: string; // For reference only
}

const stations: StationSeed[] = [
  // ── HIGH COURT STATIONS (47 total) ──────────────────────────────────────────
  // Based on document: 47 High Court Stations across Kenya
  
  // 1. Mombasa High Court
  { name: 'Mombasa High Court', type: 'high_court', location: 'Mombasa', county: 'Mombasa' },
  
  // 2. Kwale High Court (GN 6943, effective 15th September 2020)
  { name: 'Kwale High Court', type: 'high_court', location: 'Kwale', county: 'Kwale' },
  
  // 3. Malindi High Court
  { name: 'Malindi High Court', type: 'high_court', location: 'Malindi', county: 'Kilifi' },
  
  // 4. Garsen High Court (GN 5545, effective 1st September 2015)
  { name: 'Garsen High Court', type: 'high_court', location: 'Garsen', county: 'Tana River' },
  
  // 5. Voi High Court (GN 5546, effective 1st September 2015)
  { name: 'Voi High Court', type: 'high_court', location: 'Voi', county: 'Taita Taveta' },
  
  // 6. Garissa High Court
  { name: 'Garissa High Court', type: 'high_court', location: 'Garissa', county: 'Garissa' },
  
  // 7. Marsabit High Court (GN 5536, effective 1st September 2015)
  { name: 'Marsabit High Court', type: 'high_court', location: 'Marsabit', county: 'Marsabit' },
  
  // 8. Isiolo High Court (GN 6949, effective 1st July 2024 - elevated from sub-registry)
  { name: 'Isiolo High Court', type: 'high_court', location: 'Isiolo', county: 'Isiolo' },
  
  // 9. Meru High Court
  { name: 'Meru High Court', type: 'high_court', location: 'Meru', county: 'Meru' },
  
  // 10. Chuka High Court (GN 5540, effective 1st September 2015)
  { name: 'Chuka High Court', type: 'high_court', location: 'Chuka', county: 'Tharaka-Nithi' },
  
  // 11. Embu High Court
  { name: 'Embu High Court', type: 'high_court', location: 'Embu', county: 'Embu' },
  
  // 12. Kitui High Court (GN 5542, effective 1st September 2015)
  { name: 'Kitui High Court', type: 'high_court', location: 'Kitui', county: 'Kitui' },
  
  // 13. Machakos High Court
  { name: 'Machakos High Court', type: 'high_court', location: 'Machakos', county: 'Machakos' },
  
  // 14. Makueni High Court (GN 296, effective 9th January 2017)
  { name: 'Makueni High Court', type: 'high_court', location: 'Makueni', county: 'Makueni' },
  
  // 15. Nyandarua High Court (GN 11084, effective 25th August 2023)
  { name: 'Nyandarua High Court', type: 'high_court', location: 'Nyandarua', county: 'Nyandarua' },
  
  // 16. Nyeri High Court
  { name: 'Nyeri High Court', type: 'high_court', location: 'Nyeri', county: 'Nyeri' },
  
  // 17. Kerugoya High Court
  { name: 'Kerugoya High Court', type: 'high_court', location: 'Kerugoya', county: 'Kirinyaga' },
  
  // 18. Murang'a High Court
  { name: "Murang'a High Court", type: 'high_court', location: "Murang'a", county: "Murang'a" },
  
  // 19. Kiambu High Court (GN 2881, effective 2nd June 2016)
  { name: 'Kiambu High Court', type: 'high_court', location: 'Kiambu', county: 'Kiambu' },
  
  // 20. Thika High Court (GN 11082, effective 25th August 2023 - elevated from sub-registry)
  { name: 'Thika High Court', type: 'high_court', location: 'Thika', county: 'Kiambu' },
  
  // 21. Lodwar High Court (GN 5544, effective 1st September 2015)
  { name: 'Lodwar High Court', type: 'high_court', location: 'Lodwar', county: 'Turkana' },
  
  // 22. Kapenguria High Court (GN 5537, effective 1st September 2015)
  { name: 'Kapenguria High Court', type: 'high_court', location: 'Kapenguria', county: 'West Pokot' },
  
  // 23. Kitale High Court
  { name: 'Kitale High Court', type: 'high_court', location: 'Kitale', county: 'Trans Nzoia' },
  
  // 24. Eldoret High Court
  { name: 'Eldoret High Court', type: 'high_court', location: 'Eldoret', county: 'Uasin Gishu' },
  
  // 25. Kapsabet High Court (GN 656, effective 16th January 2023 - elevated from sub-registry)
  { name: 'Kapsabet High Court', type: 'high_court', location: 'Kapsabet', county: 'Nandi' },
  
  // 26. Kabarnet High Court (GN 5538, effective 1st September 2015)
  { name: 'Kabarnet High Court', type: 'high_court', location: 'Kabarnet', county: 'Baringo' },
  
  // 27. Nanyuki High Court (GN 5539, effective 1st September 2015)
  { name: 'Nanyuki High Court', type: 'high_court', location: 'Nanyuki', county: 'Laikipia' },
  
  // 28. Nyahururu High Court (GN 298, effective 9th January 2017)
  { name: 'Nyahururu High Court', type: 'high_court', location: 'Nyahururu', county: 'Laikipia' },
  
  // 29. Nakuru High Court
  { name: 'Nakuru High Court', type: 'high_court', location: 'Nakuru', county: 'Nakuru' },
  
  // 30. Naivasha High Court (GN 5177, effective 1st August 2014)
  { name: 'Naivasha High Court', type: 'high_court', location: 'Naivasha', county: 'Nakuru' },
  
  // 31. Narok High Court (GN 297, effective 6th January 2017)
  { name: 'Narok High Court', type: 'high_court', location: 'Narok', county: 'Narok' },
  
  // 32. Kajiado High Court (GN 5541, effective 1st September 2015)
  { name: 'Kajiado High Court', type: 'high_court', location: 'Kajiado', county: 'Kajiado' },
  
  // 33. Kericho High Court
  { name: 'Kericho High Court', type: 'high_court', location: 'Kericho', county: 'Kericho' },
  
  // 34. Bomet High Court (GN 5543, effective 1st September 2015)
  { name: 'Bomet High Court', type: 'high_court', location: 'Bomet', county: 'Bomet' },
  
  // 35. Kakamega High Court
  { name: 'Kakamega High Court', type: 'high_court', location: 'Kakamega', county: 'Kakamega' },
  
  // 36. Vihiga High Court (GN 6942, effective 15th September 2020)
  { name: 'Vihiga High Court', type: 'high_court', location: 'Vihiga', county: 'Vihiga' },
  
  // 37. Bungoma High Court
  { name: 'Bungoma High Court', type: 'high_court', location: 'Bungoma', county: 'Bungoma' },
  
  // 38. Busia High Court
  { name: 'Busia High Court', type: 'high_court', location: 'Busia', county: 'Busia' },
  
  // 39. Siaya High Court (GN 5534, effective 1st September 2015)
  { name: 'Siaya High Court', type: 'high_court', location: 'Siaya', county: 'Siaya' },
  
  // 40. Kisumu High Court
  { name: 'Kisumu High Court', type: 'high_court', location: 'Kisumu', county: 'Kisumu' },
  
  // 41. HomaBay High Court
  { name: 'Homabay High Court', type: 'high_court', location: 'Homabay', county: 'Homa-Bay' },
  
  // 42. Migori High Court (GN 5176, effective 1st August 2014)
  { name: 'Migori High Court', type: 'high_court', location: 'Migori', county: 'Migori' },
  
  // 43. Kisii High Court
  { name: 'Kisii High Court', type: 'high_court', location: 'Kisii', county: 'Kisii' },
  
  // 44. Nyamira High Court (GN 5535, effective 1st September 2015)
  { name: 'Nyamira High Court', type: 'high_court', location: 'Nyamira', county: 'Nyamira' },
  
  // 45. Milimani High Court (Nairobi - multiple divisions)
  { name: 'Milimani High Court', type: 'high_court', location: 'Nairobi', county: 'Nairobi' },
  
  // 46. Kibera High Court (GN 11083, effective 15th September 2023)
  { name: 'Kibera High Court', type: 'high_court', location: 'Nairobi', county: 'Nairobi' },
  
  // 47. Makadara High Court (GN 14582, effective 2nd January 2025)
  { name: 'Makadara High Court', type: 'high_court', location: 'Nairobi', county: 'Nairobi' },

  // ── HIGH COURT SUB-REGISTRIES (7 total) ────────────────────────────────────
  // Based on document: 7 High Court Sub-Registries
  
  // 1. Lamu High Court Sub-Registry (5471 effective 19th April 2023) - Supervised by Garsen
  { name: 'Lamu High Court Sub-Registry', type: 'sub_registry', location: 'Lamu', county: 'Lamu' },
  
  // 2. Wajir High Court Sub-Registry (4071 effective 15th September 2024) - Supervised by Garissa
  { name: 'Wajir High Court Sub-Registry', type: 'sub_registry', location: 'Wajir', county: 'Wajir' },
  
  // 3. Mandera High Court Sub-Registry (10128 effective 7th August 2023) - Supervised by Garissa
  { name: 'Mandera High Court Sub-Registry', type: 'sub_registry', location: 'Mandera', county: 'Mandera' },
  
  // 4. Maralal High Court Sub-Registry (10129 effective 7th August 2023) - Supervised by Nanyuki
  { name: 'Maralal High Court Sub-Registry', type: 'sub_registry', location: 'Maralal', county: 'Samburu' },
  
  // 5. Iten High Court Sub-Registry (657 effective 16th January 2023) - Supervised by Eldoret
  { name: 'Iten High Court Sub-Registry', type: 'sub_registry', location: 'Iten', county: 'Elgeyo Marakwet' },
  
  // 6. Eldama Ravine High Court Sub-Registry (6945 effective 15th September 2020) - Supervised by Kabarnet
  { name: 'Eldama Ravine High Court Sub-Registry', type: 'sub_registry', location: 'Eldama Ravine', county: 'Baringo' },
  
  // 7. Kilgoris High Court Sub-Registry (6945 effective 15th September 2020) - Supervised by Narok
  { name: 'Kilgoris High Court Sub-Registry', type: 'sub_registry', location: 'Kilgoris', county: 'Narok' },

  // ── KADHIS COURTS ───────────────────────────────────────────────────────────
  // Based on document: Kadhis Courts under various High Courts
  
  { name: 'Mombasa Kadhis Court', type: 'kadhis_court', location: 'Mombasa', county: 'Mombasa' },
  { name: 'Balambala Kadhis Court', type: 'kadhis_court', location: 'Balambala', county: 'Garissa' },
  { name: 'Bute Kadhis Court', type: 'kadhis_court', location: 'Bute', county: 'Garissa' },
  { name: 'Eldas Kadhis Court', type: 'kadhis_court', location: 'Eldas', county: 'Garissa' },
  { name: 'Elwak Kadhis Court', type: 'kadhis_court', location: 'Elwak', county: 'Garissa' },
  { name: 'Modogashe Kadhis Court', type: 'kadhis_court', location: 'Modogashe', county: 'Garissa' },
  { name: 'Habasweini Kadhis Court', type: 'kadhis_court', location: 'Habasweini', county: 'Garissa' },
  { name: 'Ijara Kadhis Court', type: 'kadhis_court', location: 'Ijara', county: 'Garissa' },
  { name: 'Takaba Kadhis Court', type: 'kadhis_court', location: 'Takaba', county: 'Garissa' },
  { name: 'Bura/Fafi Kadhis Court', type: 'kadhis_court', location: 'Bura/Fafi', county: 'Garissa' },
  { name: 'Witu Kadhis Court', type: 'kadhis_court', location: 'Witu', county: 'Garissa' },
  { name: 'Garbatulla Kadhis Court', type: 'kadhis_court', location: 'Garbatulla', county: 'Isiolo' },
  { name: 'Merti Kadhis Court', type: 'kadhis_court', location: 'Merti', county: 'Isiolo' },
  { name: 'Upperhill Kadhis Court', type: 'kadhis_court', location: 'Nairobi', county: 'Nairobi' },

  // ── MAGISTRATE COURTS UNDER SUPERVISORY JURISDICTION ──────────────────────
  // Based on document: Complete list of Magistrate Courts under each High Court
  
  // Mombasa High Court Supervisory Jurisdiction
  { name: 'Mombasa Magistrates Court', type: 'magistrate_court', location: 'Mombasa', county: 'Mombasa' },
  { name: 'Tononoka Magistrates Court', type: 'magistrate_court', location: 'Mombasa', county: 'Mombasa' },
  { name: 'Shanzu Magistrates Court', type: 'magistrate_court', location: 'Mombasa', county: 'Mombasa' },
  
  // Kwale High Court Supervisory Jurisdiction
  { name: 'Kwale Magistrates Court', type: 'magistrate_court', location: 'Kwale', county: 'Kwale' },
  { name: 'Msambweni Magistrates Court', type: 'magistrate_court', location: 'Msambweni', county: 'Kwale' },
  
  // Malindi High Court Supervisory Jurisdiction
  { name: 'Malindi Magistrates Court', type: 'magistrate_court', location: 'Malindi', county: 'Kilifi' },
  { name: 'Kilifi Magistrates Court', type: 'magistrate_court', location: 'Kilifi', county: 'Kilifi' },
  { name: 'Kaloleni Magistrates Court', type: 'magistrate_court', location: 'Kaloleni', county: 'Kilifi' },
  { name: 'Mariakani Magistrates Court', type: 'magistrate_court', location: 'Mariakani', county: 'Kilifi' },
  
  // Garsen High Court Supervisory Jurisdiction
  { name: 'Garsen Magistrates Court', type: 'magistrate_court', location: 'Garsen', county: 'Tana River' },
  { name: 'Hola Magistrates Court', type: 'magistrate_court', location: 'Hola', county: 'Tana River' },
  { name: 'Lamu Magistrates Court', type: 'magistrate_court', location: 'Lamu', county: 'Lamu' },
  { name: 'Mpeketoni Magistrates Court', type: 'magistrate_court', location: 'Mpeketoni', county: 'Lamu' },
  
  // Voi High Court Supervisory Jurisdiction
  { name: 'Voi Magistrates Court', type: 'magistrate_court', location: 'Voi', county: 'Taita Taveta' },
  { name: 'Taveta Magistrates Court', type: 'magistrate_court', location: 'Taveta', county: 'Taita Taveta' },
  { name: 'Wundanyi Magistrates Court', type: 'magistrate_court', location: 'Wundanyi', county: 'Taita Taveta' },
  
  // Garissa High Court Supervisory Jurisdiction
  { name: 'Garissa Magistrates Court', type: 'magistrate_court', location: 'Garissa', county: 'Garissa' },
  { name: 'Masalani Magistrates Court', type: 'magistrate_court', location: 'Masalani', county: 'Garissa' },
  { name: 'Wajir Magistrates Court', type: 'magistrate_court', location: 'Wajir', county: 'Wajir' },
  { name: 'Mandera Magistrates Court', type: 'magistrate_court', location: 'Mandera', county: 'Mandera' },
  
  // Marsabit High Court Supervisory Jurisdiction
  { name: 'Marsabit Magistrates Court', type: 'magistrate_court', location: 'Marsabit', county: 'Marsabit' },
  { name: 'Moyale Magistrates Court', type: 'magistrate_court', location: 'Moyale', county: 'Marsabit' },
  
  // Isiolo High Court Supervisory Jurisdiction
  { name: 'Isiolo Magistrates Court', type: 'magistrate_court', location: 'Isiolo', county: 'Isiolo' },
  { name: 'Garbatulla Magistrates Court', type: 'magistrate_court', location: 'Garbatulla', county: 'Isiolo' },
  
  // Meru High Court Supervisory Jurisdiction
  { name: 'Meru Magistrates Court', type: 'magistrate_court', location: 'Meru', county: 'Meru' },
  { name: 'Nkubu Magistrates Court', type: 'magistrate_court', location: 'Nkubu', county: 'Meru' },
  { name: 'Maua Magistrates Court', type: 'magistrate_court', location: 'Maua', county: 'Meru' },
  { name: 'Tigania Magistrates Court', type: 'magistrate_court', location: 'Tigania', county: 'Meru' },
  { name: 'Githongo Magistrates Court', type: 'magistrate_court', location: 'Githongo', county: 'Meru' },
  
  // Chuka High Court Supervisory Jurisdiction
  { name: 'Chuka Magistrates Court', type: 'magistrate_court', location: 'Chuka', county: 'Tharaka-Nithi' },
  { name: 'Marimanti Magistrates Court', type: 'magistrate_court', location: 'Marimanti', county: 'Tharaka-Nithi' },
  
  // Embu High Court Supervisory Jurisdiction
  { name: 'Embu Magistrates Court', type: 'magistrate_court', location: 'Embu', county: 'Embu' },
  { name: 'Runyenjes Magistrates Court', type: 'magistrate_court', location: 'Runyenjes', county: 'Embu' },
  { name: 'Siakago Magistrates Court', type: 'magistrate_court', location: 'Siakago', county: 'Embu' },
  
  // Kitui High Court Supervisory Jurisdiction
  { name: 'Kitui Magistrates Court', type: 'magistrate_court', location: 'Kitui', county: 'Kitui' },
  { name: 'Mwingi Magistrates Court', type: 'magistrate_court', location: 'Mwingi', county: 'Kitui' },
  { name: 'Kyuso Magistrates Court', type: 'magistrate_court', location: 'Kyuso', county: 'Kitui' },
  { name: 'Mutomo Magistrates Court', type: 'magistrate_court', location: 'Mutomo', county: 'Kitui' },
  { name: 'Zombe Magistrates Court', type: 'magistrate_court', location: 'Zombe', county: 'Kitui' },
  { name: 'Mutitu Magistrates Court', type: 'magistrate_court', location: 'Mutitu', county: 'Kitui' },
  
  // Machakos High Court Supervisory Jurisdiction
  { name: 'Machakos Magistrates Court', type: 'magistrate_court', location: 'Machakos', county: 'Machakos' },
  { name: 'Kithimani Magistrates Court', type: 'magistrate_court', location: 'Kithimani', county: 'Machakos' },
  { name: 'Kangundo Magistrates Court', type: 'magistrate_court', location: 'Kangundo', county: 'Machakos' },
  { name: 'Mavoko Magistrates Court', type: 'magistrate_court', location: 'Mavoko', county: 'Machakos' },
  { name: 'Wamunyu Magistrates Court', type: 'magistrate_court', location: 'Wamunyu', county: 'Machakos' },
  { name: 'Masinga Magistrates Court', type: 'magistrate_court', location: 'Masinga', county: 'Machakos' },
  
  // Makueni High Court Supervisory Jurisdiction
  { name: 'Makueni Magistrates Court', type: 'magistrate_court', location: 'Makueni', county: 'Makueni' },
  { name: 'Tawa Magistrates Court', type: 'magistrate_court', location: 'Tawa', county: 'Makueni' },
  { name: 'Kilungu Magistrates Court', type: 'magistrate_court', location: 'Kilungu', county: 'Makueni' },
  { name: 'Makindu Magistrates Court', type: 'magistrate_court', location: 'Makindu', county: 'Makueni' },
  { name: 'Matiliku Magistrates Court', type: 'magistrate_court', location: 'Matiliku', county: 'Makueni' },
  
  // Nyandarua High Court Supervisory Jurisdiction
  { name: 'Ol-Kalau Magistrates Court', type: 'magistrate_court', location: 'Ol-Kalau', county: 'Nyandarua' },
  { name: 'Engineer Magistrates Court', type: 'magistrate_court', location: 'Engineer', county: 'Nyandarua' },
  
  // Nyeri High Court Supervisory Jurisdiction
  { name: 'Nyeri Magistrates Court', type: 'magistrate_court', location: 'Nyeri', county: 'Nyeri' },
  { name: 'Othaya Magistrates Court', type: 'magistrate_court', location: 'Othaya', county: 'Nyeri' },
  { name: 'Karatina Magistrates Court', type: 'magistrate_court', location: 'Karatina', county: 'Nyeri' },
  { name: 'Mukurwe-ini Magistrates Court', type: 'magistrate_court', location: 'Mukurwe-ini', county: 'Nyeri' },
  
  // Kerugoya High Court Supervisory Jurisdiction
  { name: 'Kerugoya Magistrates Court', type: 'magistrate_court', location: 'Kerugoya', county: 'Kirinyaga' },
  { name: 'Baricho Magistrates Court', type: 'magistrate_court', location: 'Baricho', county: 'Kirinyaga' },
  { name: 'Gichugu Magistrates Court', type: 'magistrate_court', location: 'Gichugu', county: 'Kirinyaga' },
  { name: "Wang'uru Magistrates Court", type: 'magistrate_court', location: "Wang'uru", county: 'Kirinyaga' },
  
  // Murang'a High Court Supervisory Jurisdiction
  { name: "Murang'a Magistrates Court", type: 'magistrate_court', location: "Murang'a", county: "Murang'a" },
  { name: 'Kangema Magistrates Court', type: 'magistrate_court', location: 'Kangema', county: "Murang'a" },
  { name: 'Kigumo Magistrates Court', type: 'magistrate_court', location: 'Kigumo', county: "Murang'a" },
  { name: 'Kandara Magistrates Court', type: 'magistrate_court', location: 'Kandara', county: "Murang'a" },
  { name: 'Kenol Magistrates Court', type: 'magistrate_court', location: 'Kenol', county: "Murang'a" },
  { name: 'Gatanga Magistrates Court', type: 'magistrate_court', location: 'Gatanga', county: "Murang'a" },
  
  // Kiambu High Court Supervisory Jurisdiction
  { name: 'Kiambu Magistrates Court', type: 'magistrate_court', location: 'Kiambu', county: 'Kiambu' },
  { name: 'Githunguri Magistrates Court', type: 'magistrate_court', location: 'Githunguri', county: 'Kiambu' },
  { name: 'Limuru Magistrates Court', type: 'magistrate_court', location: 'Limuru', county: 'Kiambu' },
  { name: 'Kikuyu Magistrates Court', type: 'magistrate_court', location: 'Kikuyu', county: 'Kiambu' },
  { name: 'Lari Magistrates Court', type: 'magistrate_court', location: 'Lari', county: 'Kiambu' },
  { name: 'Kabete Magistrates Court', type: 'magistrate_court', location: 'Kabete', county: 'Kiambu' },
  { name: 'Thika Magistrates Court', type: 'magistrate_court', location: 'Thika', county: 'Kiambu' },
  { name: 'Kamwangi Magistrates Court', type: 'magistrate_court', location: 'Kamwangi', county: 'Kiambu' },
  { name: 'Ruiru Magistrates Court', type: 'magistrate_court', location: 'Ruiru', county: 'Kiambu' },
  { name: 'Gatundu Magistrates Court', type: 'magistrate_court', location: 'Gatundu', county: 'Kiambu' },
  
  // Lodwar High Court Supervisory Jurisdiction
  { name: 'Lodwar Magistrates Court', type: 'magistrate_court', location: 'Lodwar', county: 'Turkana' },
  { name: 'Kakuma Magistrates Court', type: 'magistrate_court', location: 'Kakuma', county: 'Turkana' },
  { name: 'Lokichar Magistrates Court', type: 'magistrate_court', location: 'Lokichar', county: 'Turkana' },
  { name: 'Lokitaung Magistrates Court', type: 'magistrate_court', location: 'Lokitaung', county: 'Turkana' },
  
  // Kapenguria High Court Supervisory Jurisdiction
  { name: 'Kapenguria Magistrates Court', type: 'magistrate_court', location: 'Kapenguria', county: 'West Pokot' },
  { name: 'Sigor Magistrates Court', type: 'magistrate_court', location: 'Sigor', county: 'West Pokot' },
  { name: 'Kanyao Magistrates Court', type: 'magistrate_court', location: 'Kanyao', county: 'West Pokot' },
  
  // Nanyuki High Court Supervisory Jurisdiction (includes Maralal Sub-Registry)
  { name: 'Nanyuki Magistrates Court', type: 'magistrate_court', location: 'Nanyuki', county: 'Laikipia' },
  { name: 'Rumuruti Magistrates Court', type: 'magistrate_court', location: 'Rumuruti', county: 'Laikipia' },
  { name: 'Wamba Magistrates Court', type: 'magistrate_court', location: 'Wamba', county: 'Laikipia' },
  { name: 'Baragoi Magistrates Court', type: 'magistrate_court', location: 'Baragoi', county: 'Laikipia' },
  { name: 'Maralal Magistrates Court', type: 'magistrate_court', location: 'Maralal', county: 'Samburu' },
  
  // Nyahururu High Court Supervisory Jurisdiction
  { name: 'Nyahururu Magistrates Court', type: 'magistrate_court', location: 'Nyahururu', county: 'Laikipia' },
  
  // Kitale High Court Supervisory Jurisdiction
  { name: 'Kitale Magistrates Court', type: 'magistrate_court', location: 'Kitale', county: 'Trans Nzoia' },
  
  // Eldoret High Court Supervisory Jurisdiction (includes Iten Sub-Registry)
  { name: 'Eldoret Magistrates Court', type: 'magistrate_court', location: 'Eldoret', county: 'Uasin Gishu' },
  { name: 'Kabiyet Magistrates Court', type: 'magistrate_court', location: 'Kabiyet', county: 'Uasin Gishu' },
  { name: 'Tinderet Magistrates Court', type: 'magistrate_court', location: 'Tinderet', county: 'Uasin Gishu' },
  { name: 'Chepkorio Magistrates Court', type: 'magistrate_court', location: 'Chepkorio', county: 'Uasin Gishu' },
  { name: 'Chesoi Magistrates Court', type: 'magistrate_court', location: 'Chesoi', county: 'Uasin Gishu' },
  { name: 'Iten Magistrates Court', type: 'magistrate_court', location: 'Iten', county: 'Elgeyo Marakwet' },
  
  // Kapsabet High Court Supervisory Jurisdiction
  { name: 'Kapsabet Magistrates Court', type: 'magistrate_court', location: 'Kapsabet', county: 'Nandi' },
  
  // Kabarnet High Court Supervisory Jurisdiction (includes Eldama Ravine Sub-Registry)
  { name: 'Kabarnet Magistrates Court', type: 'magistrate_court', location: 'Kabarnet', county: 'Baringo' },
  { name: 'Eldama Ravine Magistrates Court', type: 'magistrate_court', location: 'Eldama Ravine', county: 'Baringo' },
  { name: 'Marigat Magistrates Court', type: 'magistrate_court', location: 'Marigat', county: 'Baringo' },
  
  // Nakuru High Court Supervisory Jurisdiction
  { name: 'Nakuru Magistrates Court', type: 'magistrate_court', location: 'Nakuru', county: 'Nakuru' },
  { name: 'Molo Magistrates Court', type: 'magistrate_court', location: 'Molo', county: 'Nakuru' },
  { name: 'Naivasha Magistrates Court', type: 'magistrate_court', location: 'Naivasha', county: 'Nakuru' },
  
  // Narok High Court Supervisory Jurisdiction (includes Kilgoris Sub-Registry)
  { name: 'Narok Magistrates Court', type: 'magistrate_court', location: 'Narok', county: 'Narok' },
  { name: 'Kilgoris Magistrates Court', type: 'magistrate_court', location: 'Kilgoris', county: 'Narok' },
  
  // Kajiado High Court Supervisory Jurisdiction
  { name: 'Kajiado Magistrates Court', type: 'magistrate_court', location: 'Kajiado', county: 'Kajiado' },
  { name: 'Loitoktok Magistrates Court', type: 'magistrate_court', location: 'Loitoktok', county: 'Kajiado' },
  { name: 'Ngong Magistrates Court', type: 'magistrate_court', location: 'Ngong', county: 'Kajiado' },
  
  // Kericho High Court Supervisory Jurisdiction
  { name: 'Kericho Magistrates Court', type: 'magistrate_court', location: 'Kericho', county: 'Kericho' },
  { name: 'Kipkelion Magistrates Court', type: 'magistrate_court', location: 'Kipkelion', county: 'Kericho' },
  { name: 'Chepkemel Magistrates Court', type: 'magistrate_court', location: 'Chepkemel', county: 'Kericho' },
  
  // Bomet High Court Supervisory Jurisdiction
  { name: 'Bomet Magistrates Court', type: 'magistrate_court', location: 'Bomet', county: 'Bomet' },
  { name: 'Sotik Magistrates Court', type: 'magistrate_court', location: 'Sotik', county: 'Bomet' },
  
  // Kakamega High Court Supervisory Jurisdiction
  { name: 'Kakamega Magistrates Court', type: 'magistrate_court', location: 'Kakamega', county: 'Kakamega' },
  { name: 'Mumias Magistrates Court', type: 'magistrate_court', location: 'Mumias', county: 'Kakamega' },
  { name: 'Butere Magistrates Court', type: 'magistrate_court', location: 'Butere', county: 'Kakamega' },
  { name: 'Khwisero Magistrates Court', type: 'magistrate_court', location: 'Khwisero', county: 'Kakamega' },
  
  // Vihiga High Court Supervisory Jurisdiction
  { name: 'Vihiga Magistrates Court', type: 'magistrate_court', location: 'Vihiga', county: 'Vihiga' },
  { name: 'Butali Magistrates Court', type: 'magistrate_court', location: 'Butali', county: 'Vihiga' },
  { name: 'Hamisi Magistrates Court', type: 'magistrate_court', location: 'Hamisi', county: 'Vihiga' },
  
  // Bungoma High Court Supervisory Jurisdiction
  { name: 'Bungoma Magistrates Court', type: 'magistrate_court', location: 'Bungoma', county: 'Bungoma' },
  { name: 'Webuye Magistrates Court', type: 'magistrate_court', location: 'Webuye', county: 'Bungoma' },
  { name: 'Kimilili Magistrates Court', type: 'magistrate_court', location: 'Kimilili', county: 'Bungoma' },
  { name: 'Sirisia Magistrates Court', type: 'magistrate_court', location: 'Sirisia', county: 'Bungoma' },
  
  // Busia High Court Supervisory Jurisdiction
  { name: 'Busia Magistrates Court', type: 'magistrate_court', location: 'Busia', county: 'Busia' },
  { name: 'Port Victoria Magistrates Court', type: 'magistrate_court', location: 'Port Victoria', county: 'Busia' },
  { name: 'Malaba Magistrates Court', type: 'magistrate_court', location: 'Malaba', county: 'Busia' },
  
  // Siaya High Court Supervisory Jurisdiction
  { name: 'Siaya Magistrates Court', type: 'magistrate_court', location: 'Siaya', county: 'Siaya' },
  { name: 'Bondo Magistrates Court', type: 'magistrate_court', location: 'Bondo', county: 'Siaya' },
  { name: 'Ukwala Magistrates Court', type: 'magistrate_court', location: 'Ukwala', county: 'Siaya' },
  { name: 'Madiany Magistrates Court', type: 'magistrate_court', location: 'Madiany', county: 'Siaya' },
  { name: 'Usigu Magistrates Court', type: 'magistrate_court', location: 'Usigu', county: 'Siaya' },
  { name: 'Yala Magistrates Court', type: 'magistrate_court', location: 'Yala', county: 'Siaya' },
  
  // Kisumu High Court Supervisory Jurisdiction
  { name: 'Kisumu Magistrates Court', type: 'magistrate_court', location: 'Kisumu', county: 'Kisumu' },
  { name: 'Winam Magistrates Court', type: 'magistrate_court', location: 'Kisumu', county: 'Kisumu' },
  { name: 'Maseno Magistrates Court', type: 'magistrate_court', location: 'Maseno', county: 'Kisumu' },
  { name: 'Nyando Magistrates Court', type: 'magistrate_court', location: 'Nyando', county: 'Kisumu' },
  { name: 'Tamu Magistrates Court', type: 'magistrate_court', location: 'Tamu', county: 'Kisumu' },
  { name: 'Nyakach Magistrates Court', type: 'magistrate_court', location: 'Nyakach', county: 'Kisumu' },
  { name: 'Kombewa Magistrates Court', type: 'magistrate_court', location: 'Kombewa', county: 'Kisumu' },
  
  // HomaBay High Court Supervisory Jurisdiction
  { name: 'Homabay Magistrates Court', type: 'magistrate_court', location: 'Homabay', county: 'Homa-Bay' },
  { name: 'Mbita Magistrates Court', type: 'magistrate_court', location: 'Mbita', county: 'Homa-Bay' },
  { name: 'Oyugis Magistrates Court', type: 'magistrate_court', location: 'Oyugis', county: 'Homa-Bay' },
  { name: 'Ndhiwa Magistrates Court', type: 'magistrate_court', location: 'Ndhiwa', county: 'Homa-Bay' },
  { name: 'Kendu Bay Magistrates Court', type: 'magistrate_court', location: 'Kendu Bay', county: 'Homa-Bay' },
  
  // Migori High Court Supervisory Jurisdiction
  { name: 'Migori Magistrates Court', type: 'magistrate_court', location: 'Migori', county: 'Migori' },
  { name: 'Rongo Magistrates Court', type: 'magistrate_court', location: 'Rongo', county: 'Migori' },
  { name: 'Kehancha Magistrates Court', type: 'magistrate_court', location: 'Kehancha', county: 'Migori' },
  { name: 'Nyatike Magistrates Court', type: 'magistrate_court', location: 'Nyatike', county: 'Migori' },
  
  // Kisii High Court Supervisory Jurisdiction
  { name: 'Kisii Magistrates Court', type: 'magistrate_court', location: 'Kisii', county: 'Kisii' },
  { name: 'Ogembo Magistrates Court', type: 'magistrate_court', location: 'Ogembo', county: 'Kisii' },
  { name: 'Etago Magistrates Court', type: 'magistrate_court', location: 'Etago', county: 'Kisii' },
  
  // Nyamira High Court Supervisory Jurisdiction
  { name: 'Nyamira Magistrates Court', type: 'magistrate_court', location: 'Nyamira', county: 'Nyamira' },
  { name: 'Keroka Magistrates Court', type: 'magistrate_court', location: 'Keroka', county: 'Nyamira' },
  { name: 'Borabu Magistrates Court', type: 'magistrate_court', location: 'Borabu', county: 'Nyamira' },
  { name: 'Manga Magistrates Court', type: 'magistrate_court', location: 'Manga', county: 'Nyamira' },
  
  // Milimani High Court Supervisory Jurisdiction
  { name: 'Milimani Magistrates Court', type: 'magistrate_court', location: 'Nairobi', county: 'Nairobi' },
  { name: 'City Court', type: 'magistrate_court', location: 'Nairobi', county: 'Nairobi' },
  { name: 'Milimani Commercial Courts', type: 'magistrate_court', location: 'Nairobi', county: 'Nairobi' },
  { name: 'Kasarani Magistrates Court', type: 'magistrate_court', location: 'Nairobi', county: 'Nairobi' },
  
  // Kibera High Court Supervisory Jurisdiction
  { name: 'Kibera Magistrates Court', type: 'magistrate_court', location: 'Nairobi', county: 'Nairobi' },
  { name: 'Kahawa Magistrates Court', type: 'magistrate_court', location: 'Nairobi', county: 'Nairobi' },
  { name: 'Dagoretti Magistrates Court', type: 'magistrate_court', location: 'Nairobi', county: 'Nairobi' },
  
  // Makadara High Court Supervisory Jurisdiction
  { name: 'Makadara Magistrates Court', type: 'magistrate_court', location: 'Nairobi', county: 'Nairobi' },
  { name: 'JKIA Magistrates Court', type: 'magistrate_court', location: 'Nairobi', county: 'Nairobi' },
];

/* ============================================================
   SEEDER
============================================================ */

const seedStations = async (): Promise<void> => {
  const client = await pool.connect();

  try {
    console.log('🌍 Connected to PostgreSQL');
    console.log(`📋 Seeding ${stations.length} stations...`);

    await client.query('BEGIN');

    let inserted = 0;
    let skipped = 0;

    for (const station of stations) {
      const result = await client.query(
        `INSERT INTO stations (name, type, location)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO NOTHING
         RETURNING id`,
        [station.name, station.type, station.location]
      );

      if (result.rowCount && result.rowCount > 0) {
        inserted++;
      } else {
        skipped++;
      }
    }

    await client.query('COMMIT');

    console.log('🌟 Stations seeded successfully');
    console.log(`👉 Inserted: ${inserted}, Skipped (already exist): ${skipped}`);
    console.log(`📊 Total stations in database: ${inserted + skipped}`);

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    console.log('🟡 PostgreSQL pool closed');
    process.exit(0);
  }
};

seedStations();