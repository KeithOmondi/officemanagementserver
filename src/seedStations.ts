// src/seeders/seedStations.ts

import { pool } from "./config/db";
import { StationType } from "./features/stations/stations.types";


/* ============================================================
   SEED DATA  –  sourced from existing court records
============================================================ */

interface StationSeed {
  name:     string;
  type:     StationType;
  location: string | null;
}

const stations: StationSeed[] = [
  // ── High Court Stations ─────────────────────────────────────────────────────
  { name: 'Bomet High Court',                          type: 'high_court',  location: 'Bomet'         },
  { name: 'Bungoma High Court',                        type: 'high_court',  location: 'Bungoma'       },
  { name: 'Busia High Court',                          type: 'high_court',  location: 'Busia'         },
  { name: 'Chuka High Court',                          type: 'high_court',  location: 'Chuka'         },
  { name: 'Eldoret High Court',                        type: 'high_court',  location: 'Eldoret'       },
  { name: 'Eldama Ravine High Court',                  type: 'sub_registry', location: 'Eldama Ravine' },
  { name: 'Embu High Court',                           type: 'high_court',  location: 'Embu'          },
  { name: 'Garissa High Court',                        type: 'high_court',  location: 'Garissa'       },
  { name: 'Garsen High Court',                         type: 'high_court',  location: 'Garsen'        },
  { name: 'Homabay High Court',                        type: 'high_court',  location: 'Homabay'       },
  { name: 'Isiolo High Court',                         type: 'high_court',  location: 'Isiolo'        },
  { name: 'Kabarnet High Court',                       type: 'high_court',  location: 'Kabarnet'      },
  { name: 'Kajiado High Court',                        type: 'high_court',  location: 'Kajiado'       },
  { name: 'Kakamega High Court',                       type: 'high_court',  location: 'Kakamega'      },
  { name: 'Kapenguria High Court',                     type: 'high_court',  location: 'Kapenguria'    },
  { name: 'Kapsabet High Court',                       type: 'high_court',  location: 'Kapsabet'      },
  { name: 'Kericho High Court',                        type: 'high_court',  location: 'Kericho'       },
  { name: 'Kerugoya High Court',                       type: 'high_court',  location: 'Kerugoya'      },
  { name: 'Kiambu High Court',                         type: 'high_court',  location: 'Kiambu'        },
  { name: 'Kibera High Court',                         type: 'high_court',  location: 'Nairobi'       },
  { name: 'Kilgoris High Court',                       type: 'sub_registry', location: 'Kilgoris'     },
  { name: 'Kisii High Court',                          type: 'high_court',  location: 'Kisii'         },
  { name: 'Kisumu High Court',                         type: 'high_court',  location: 'Kisumu'        },
  { name: 'Kitale High Court',                         type: 'high_court',  location: 'Kitale'        },
  { name: 'Kitui High Court',                          type: 'high_court',  location: 'Kitui'         },
  { name: 'Kwale High Court',                          type: 'high_court',  location: 'Kwale'         },
  { name: 'Lamu High Court',                           type: 'sub_registry', location: 'Lamu'         },
  { name: 'Lodwar High Court',                         type: 'high_court',  location: 'Lodwar'        },
  { name: 'Machakos High Court',                       type: 'high_court',  location: 'Machakos'      },
  { name: 'Makadara High Court',                       type: 'high_court',  location: 'Nairobi'       },
  { name: 'Makueni High Court',                        type: 'high_court',  location: 'Makueni'       },
  { name: 'Malindi High Court',                        type: 'high_court',  location: 'Malindi'       },
  { name: 'Mandera High Court',                        type: 'sub_registry', location: 'Mandera'      },
  { name: 'Maralal High Court',                        type: 'sub_registry', location: 'Maralal'      },
  { name: 'Marsabit High Court',                       type: 'high_court',  location: 'Marsabit'      },
  { name: 'Meru High Court',                           type: 'high_court',  location: 'Meru'          },
  { name: 'Migori High Court',                         type: 'high_court',  location: 'Migori'        },
  { name: 'Milimani Commercial High Court',            type: 'high_court',  location: 'Nairobi'       },
  { name: 'Milimani Family Division High Court',       type: 'high_court',  location: 'Nairobi'       },
  { name: 'Milimani Judicial Review High Court',       type: 'high_court',  location: 'Nairobi'       },
  { name: 'Mombasa High Court',                        type: 'high_court',  location: 'Mombasa'       },
  { name: 'Muranga High Court',                        type: 'high_court',  location: "Murang'a"      },
  { name: 'Naivasha High Court',                       type: 'high_court',  location: 'Naivasha'      },
  { name: 'Nakuru High Court',                         type: 'high_court',  location: 'Nakuru'        },
  { name: 'Nanyuki High Court',                        type: 'high_court',  location: 'Nanyuki'       },
  { name: 'Narok High Court',                          type: 'high_court',  location: 'Narok'         },
  { name: 'Nyahururu High Court',                      type: 'high_court',  location: 'Nyahururu'     },
  { name: 'Nyamira High Court',                        type: 'high_court',  location: 'Nyamira'       },
  { name: 'Nyandarua High Court',                      type: 'high_court',  location: 'Nyandarua'     },
  { name: 'Siaya High Court',                          type: 'high_court',  location: 'Siaya'         },
  { name: 'Thika High Court',                          type: 'high_court',  location: 'Thika'         },
  { name: 'Vihiga High Court',                         type: 'high_court',  location: 'Vihiga'        },
  { name: 'Wajir High Court',                          type: 'sub_registry', location: 'Wajir'        },

  // ── Kadhis Courts ───────────────────────────────────────────────────────────
  { name: 'Balambala Kadhis Court',                    type: 'kadhis_court', location: 'Balambala'    },
  { name: 'Bute Kadhis Court',                         type: 'kadhis_court', location: 'Bute'         },
  { name: 'Eldas Kadhis Court',                        type: 'kadhis_court', location: 'Eldas'        },
  { name: 'Elwak Kadhis Court',                        type: 'kadhis_court', location: 'Elwak'        },
  { name: 'Garbatulla Kadhis Court',                   type: 'kadhis_court', location: 'Garbatulla'   },
  { name: 'Habaswein Kadhis Court',                    type: 'kadhis_court', location: 'Habaswein'    },
  { name: 'Ijara Kadhis Court',                        type: 'kadhis_court', location: 'Ijara'        },
  { name: 'Merti Kadhis Court',                        type: 'kadhis_court', location: 'Merti'        },
  { name: 'Mombasa Kadhis Court',                      type: 'kadhis_court', location: 'Mombasa'      },
  { name: 'Takaba Kadhis Court',                       type: 'kadhis_court', location: 'Takaba'       },
  { name: 'Upperhill Kadhis Court',                    type: 'kadhis_court', location: 'Nairobi'      },
  { name: 'Witu Kadhis Court',                         type: 'kadhis_court', location: 'Witu'         },

  // ── Magistrate Courts ───────────────────────────────────────────────────────
  { name: 'Baricho Law Courts',                        type: 'magistrate_court', location: 'Baricho'       },
  { name: 'Bondo Law Courts',                          type: 'magistrate_court', location: 'Bondo'         },
  { name: 'Bomet Law Courts',                          type: 'magistrate_court', location: 'Bomet'         },
  { name: 'Bungoma Law Courts',                        type: 'magistrate_court', location: 'Bungoma'       },
  { name: 'Busia Law Courts',                          type: 'magistrate_court', location: 'Busia'         },
  { name: 'Butali Law Courts',                         type: 'magistrate_court', location: 'Butali'        },
  { name: 'Butere Law Courts',                         type: 'magistrate_court', location: 'Butere'        },
  { name: 'Chuka Law Courts',                          type: 'magistrate_court', location: 'Chuka'         },
  { name: 'Dadaab Law Courts',                         type: 'magistrate_court', location: 'Dadaab'        },
  { name: 'Dagoretti Law Courts',                      type: 'magistrate_court', location: 'Nairobi'       },
  { name: 'Eldama Ravine Law Courts',                  type: 'magistrate_court', location: 'Eldama Ravine' },
  { name: 'Eldoret Law Courts',                        type: 'magistrate_court', location: 'Eldoret'       },
  { name: 'Embu Law Courts',                           type: 'magistrate_court', location: 'Embu'          },
  { name: 'Engineer Law Courts',                       type: 'magistrate_court', location: 'Engineer'      },
  { name: 'Etago Law Courts',                          type: 'magistrate_court', location: 'Etago'         },
  { name: 'Garissa Law Courts',                        type: 'magistrate_court', location: 'Garissa'       },
  { name: 'Garsen Law Courts',                         type: 'magistrate_court', location: 'Garsen'        },
  { name: 'Gichugu Law Courts',                        type: 'magistrate_court', location: 'Gichugu'       },
  { name: 'Githongo Law Courts',                       type: 'magistrate_court', location: 'Githongo'      },
  { name: 'Githunguri Law Courts',                     type: 'magistrate_court', location: 'Githunguri'    },
  { name: 'Hamisi Law Courts',                         type: 'magistrate_court', location: 'Hamisi'        },
  { name: 'Hola Law Courts',                           type: 'magistrate_court', location: 'Hola'          },
  { name: 'Homabay Law Courts',                        type: 'magistrate_court', location: 'Homabay'       },
  { name: 'Isiolo Law Courts',                         type: 'magistrate_court', location: 'Isiolo'        },
  { name: 'Iten Law Courts',                           type: 'magistrate_court', location: 'Iten'          },
  { name: 'JKIA Law Courts',                           type: 'magistrate_court', location: 'Nairobi'       },
  { name: 'Kabarnet Law Courts',                       type: 'magistrate_court', location: 'Kabarnet'      },
  { name: 'Kabiyet Law Courts',                        type: 'magistrate_court', location: 'Kabiyet'       },
  { name: 'Kahawa Law Courts',                         type: 'magistrate_court', location: 'Nairobi'       },
  { name: 'Kajiado Law Courts',                        type: 'magistrate_court', location: 'Kajiado'       },
  { name: 'Kakamega Law Courts',                       type: 'magistrate_court', location: 'Kakamega'      },
  { name: 'Kakuma Law Courts',                         type: 'magistrate_court', location: 'Kakuma'        },
  { name: 'Kaloleni Law Courts',                       type: 'magistrate_court', location: 'Kaloleni'      },
  { name: 'Kandara Law Courts',                        type: 'magistrate_court', location: 'Kandara'       },
  { name: 'Kangema Law Courts',                        type: 'magistrate_court', location: 'Kangema'       },
  { name: 'Kangundo Law Courts',                       type: 'magistrate_court', location: 'Kangundo'      },
  { name: 'Kamwangi Law Courts',                       type: 'magistrate_court', location: 'Kamwangi'      },
  { name: 'Kapenguria Law Courts',                     type: 'magistrate_court', location: 'Kapenguria'    },
  { name: 'Kapsabet Law Courts',                       type: 'magistrate_court', location: 'Kapsabet'      },
  { name: 'Karatina Law Courts',                       type: 'magistrate_court', location: 'Karatina'      },
  { name: 'Kehancha Law Courts',                       type: 'magistrate_court', location: 'Kehancha'      },
  { name: 'Kendu Bay Law Courts',                      type: 'magistrate_court', location: 'Kendu Bay'     },
  { name: 'Kenol Law Courts',                          type: 'magistrate_court', location: 'Kenol'         },
  { name: 'Keroka Law Courts',                         type: 'magistrate_court', location: 'Keroka'        },
  { name: 'Kerugoya Law Courts',                       type: 'magistrate_court', location: 'Kerugoya'      },
  { name: 'Khwisero Law Courts',                       type: 'magistrate_court', location: 'Khwisero'      },
  { name: 'Kiambu Law Courts',                         type: 'magistrate_court', location: 'Kiambu'        },
  { name: 'Kibera Law Courts',                         type: 'magistrate_court', location: 'Nairobi'       },
  { name: 'Kigumo Law Courts',                         type: 'magistrate_court', location: 'Kigumo'        },
  { name: 'Kikuyu Law Courts',                         type: 'magistrate_court', location: 'Kikuyu'        },
  { name: 'Kilgoris Law Courts',                       type: 'magistrate_court', location: 'Kilgoris'      },
  { name: 'Kilifi Law Courts',                         type: 'magistrate_court', location: 'Kilifi'        },
  { name: 'Kilungu Law Courts',                        type: 'magistrate_court', location: 'Kilungu'       },
  { name: 'Kimilili Law Courts',                       type: 'magistrate_court', location: 'Kimilili'      },
  { name: 'Kisii Law Courts',                          type: 'magistrate_court', location: 'Kisii'         },
  { name: 'Kisumu Law Courts',                         type: 'magistrate_court', location: 'Kisumu'        },
  { name: 'Kitale Law Courts',                         type: 'magistrate_court', location: 'Kitale'        },
  { name: 'Kitui Law Courts',                          type: 'magistrate_court', location: 'Kitui'         },
  { name: 'Kithimani Law Courts',                      type: 'magistrate_court', location: 'Kithimani'     },
  { name: 'Kombewa Law Courts',                        type: 'magistrate_court', location: 'Kombewa'       },
  { name: 'Kwale Law Courts',                          type: 'magistrate_court', location: 'Kwale'         },
  { name: 'Kyuso Law Courts',                          type: 'magistrate_court', location: 'Kyuso'         },
  { name: 'Lamu Law Courts',                           type: 'magistrate_court', location: 'Lamu'          },
  { name: 'Limuru Law Courts',                         type: 'magistrate_court', location: 'Limuru'        },
  { name: 'Lodwar Law Courts',                         type: 'magistrate_court', location: 'Lodwar'        },
  { name: 'Loitoktok Law Courts',                      type: 'magistrate_court', location: 'Loitoktok'    },
  { name: 'Machakos Law Courts',                       type: 'magistrate_court', location: 'Machakos'      },
  { name: 'Madiany Law Courts',                        type: 'magistrate_court', location: 'Madiany'       },
  { name: 'Makadara Law Courts',                       type: 'magistrate_court', location: 'Nairobi'       },
  { name: 'Makindu Law Courts',                        type: 'magistrate_court', location: 'Makindu'       },
  { name: 'Makueni Law Courts',                        type: 'magistrate_court', location: 'Makueni'       },
  { name: 'Malaba Law Courts',                         type: 'magistrate_court', location: 'Malaba'        },
  { name: 'Malindi Law Courts',                        type: 'magistrate_court', location: 'Malindi'       },
  { name: 'Mandera Law Courts',                        type: 'magistrate_court', location: 'Mandera'       },
  { name: 'Maralal Law Courts',                        type: 'magistrate_court', location: 'Maralal'       },
  { name: 'Mariakani Law Courts',                      type: 'magistrate_court', location: 'Mariakani'     },
  { name: 'Marimanti Law Courts',                      type: 'magistrate_court', location: 'Marimanti'     },
  { name: 'Marsabit Law Courts',                       type: 'magistrate_court', location: 'Marsabit'      },
  { name: 'Maseno Law Courts',                         type: 'magistrate_court', location: 'Maseno'        },
  { name: 'Maua Law Courts',                           type: 'magistrate_court', location: 'Maua'          },
  { name: 'Mavoko Law Courts',                         type: 'magistrate_court', location: 'Mavoko'        },
  { name: 'Mbita Law Courts',                          type: 'magistrate_court', location: 'Mbita'         },
  { name: 'Meru Law Courts',                           type: 'magistrate_court', location: 'Meru'          },
  { name: 'Migori Law Courts',                         type: 'magistrate_court', location: 'Migori'        },
  { name: 'Milimani Anti-Corruption Court',            type: 'magistrate_court', location: 'Nairobi'       },
  { name: "Milimani Children's Court",                 type: 'magistrate_court', location: 'Nairobi'       },
  { name: 'Milimani Commercial Court – Commercial & Civil Division', type: 'magistrate_court', location: 'Nairobi' },
  { name: 'Milimani Commercial Court – Family & Divorce Division',  type: 'magistrate_court', location: 'Nairobi' },
  { name: 'Milimani Law Courts',                       type: 'magistrate_court', location: 'Nairobi'       },
  { name: 'Moiben Law Courts',                         type: 'magistrate_court', location: 'Moiben'        },
  { name: 'Molo Law Courts',                           type: 'magistrate_court', location: 'Molo'          },
  { name: 'Mombasa Law Courts',                        type: 'magistrate_court', location: 'Mombasa'       },
  { name: 'Moyale Law Courts',                         type: 'magistrate_court', location: 'Moyale'        },
  { name: 'Mpeketoni Law Courts',                      type: 'magistrate_court', location: 'Mpeketoni'     },
  { name: 'Msambweni Law Courts',                      type: 'magistrate_court', location: 'Msambweni'     },
  { name: 'Mukurweini Law Courts',                     type: 'magistrate_court', location: 'Mukurweini'    },
  { name: 'Mumias Law Courts',                         type: 'magistrate_court', location: 'Mumias'        },
  { name: "Murang'a Law Courts",                       type: 'magistrate_court', location: "Murang'a"      },
  { name: 'Mutomo Law Courts',                         type: 'magistrate_court', location: 'Mutomo'        },
  { name: 'Mwingi Law Courts',                         type: 'magistrate_court', location: 'Mwingi'        },
  { name: 'Nairobi City County Law Courts',            type: 'magistrate_court', location: 'Nairobi'       },
  { name: 'Nairobi Small Claims Court',                type: 'magistrate_court', location: 'Nairobi'       },
  { name: 'Naivasha Law Courts',                       type: 'magistrate_court', location: 'Naivasha'      },
  { name: 'Nakuru Law Courts',                         type: 'magistrate_court', location: 'Nakuru'        },
  { name: 'Nanyuki Law Courts',                        type: 'magistrate_court', location: 'Nanyuki'       },
  { name: 'Narok Law Courts',                          type: 'magistrate_court', location: 'Narok'         },
  { name: 'Ndhiwa Law Courts',                         type: 'magistrate_court', location: 'Ndhiwa'        },
  { name: 'Ngong Law Courts',                          type: 'magistrate_court', location: 'Ngong'         },
  { name: 'Nkubu Law Courts',                          type: 'magistrate_court', location: 'Nkubu'         },
  { name: 'Nyahururu Law Courts',                      type: 'magistrate_court', location: 'Nyahururu'     },
  { name: 'Nyamira Law Courts',                        type: 'magistrate_court', location: 'Nyamira'       },
  { name: 'Nyando Law Courts',                         type: 'magistrate_court', location: 'Nyando'        },
  { name: 'Nyeri Law Courts',                          type: 'magistrate_court', location: 'Nyeri'         },
  { name: 'Ogembo Law Courts',                         type: 'magistrate_court', location: 'Ogembo'        },
  { name: 'Ol Kalou Law Courts',                       type: 'magistrate_court', location: 'Ol Kalou'      },
  { name: 'Othaya Law Courts',                         type: 'magistrate_court', location: 'Othaya'        },
  { name: 'Oyugis Law Courts',                         type: 'magistrate_court', location: 'Oyugis'        },
  { name: 'Port Victoria Law Courts',                  type: 'magistrate_court', location: 'Port Victoria' },
  { name: 'Rongo Law Courts',                          type: 'magistrate_court', location: 'Rongo'         },
  { name: 'Ruiru Law Courts',                          type: 'magistrate_court', location: 'Ruiru'         },
  { name: 'Rumuruti Law Courts',                       type: 'magistrate_court', location: 'Rumuruti'      },
  { name: 'Runyenjes Law Courts',                      type: 'magistrate_court', location: 'Runyenjes'     },
  { name: 'Shanzu Law Courts',                         type: 'magistrate_court', location: 'Mombasa'       },
  { name: 'Siakago Law Courts',                        type: 'magistrate_court', location: 'Siakago'       },
  { name: 'Siaya Law Courts',                          type: 'magistrate_court', location: 'Siaya'         },
  { name: 'Sirisia Law Courts',                        type: 'magistrate_court', location: 'Sirisia'       },
  { name: 'Sotik Law Courts',                          type: 'magistrate_court', location: 'Sotik'         },
  { name: 'Tamu Law Courts',                           type: 'magistrate_court', location: 'Tamu'          },
  { name: 'Taveta Law Courts',                         type: 'magistrate_court', location: 'Taveta'        },
  { name: 'Tawa Law Courts',                           type: 'magistrate_court', location: 'Tawa'          },
  { name: 'Thika Law Courts',                          type: 'magistrate_court', location: 'Thika'         },
  { name: 'Tigania Law Courts',                        type: 'magistrate_court', location: 'Tigania'       },
  { name: 'Tinderet Law Courts',                       type: 'magistrate_court', location: 'Tinderet'      },
  { name: 'Ukwala Law Courts',                         type: 'magistrate_court', location: 'Ukwala'        },
  { name: 'Vihiga Law Courts',                         type: 'magistrate_court', location: 'Vihiga'        },
  { name: 'Voi Law Courts',                            type: 'magistrate_court', location: 'Voi'           },
  { name: 'Wajir Law Courts',                          type: 'magistrate_court', location: 'Wajir'         },
  { name: 'Wang\'uru Law Courts',                      type: 'magistrate_court', location: "Wang'uru"      },
  { name: 'Wamunyu Law Courts',                        type: 'magistrate_court', location: 'Wamunyu'       },
  { name: 'Webuye Law Courts',                         type: 'magistrate_court', location: 'Webuye'        },
  { name: 'Winam Law Courts',                          type: 'magistrate_court', location: 'Kisumu'        },
  { name: 'Wundanyi Law Courts',                       type: 'magistrate_court', location: 'Wundanyi'      },
  { name: 'Yala Law Courts',                           type: 'magistrate_court', location: 'Yala'          },
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
    let skipped  = 0;

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