import { pool } from "./config/db";


interface JudgeData {
  s_no: number;
  name: string;
  pj_number: string;
  daily_dsa_rate: number;
}

// List of judges from the document
const judges: JudgeData[] = [
  { s_no: 1, name: 'Hon. Justice Joseph Sergon', pj_number: '38841', daily_dsa_rate: 25000 },
  { s_no: 2, name: 'Hon. Lady Justice Roseline P.V. Wendoh', pj_number: '10885', daily_dsa_rate: 25000 },
  { s_no: 3, name: 'Hon. Justice Joseph R. Karanja', pj_number: '10916', daily_dsa_rate: 25000 },
  { s_no: 4, name: 'Hon. Lady Justice Florence N. Muchemi', pj_number: '11904', daily_dsa_rate: 25000 },
  { s_no: 5, name: 'Hon. Lady Justice Maureen A.Odero', pj_number: '13998', daily_dsa_rate: 25000 },
  { s_no: 6, name: 'Hon. Justice Edward M. Muriithi', pj_number: '39512', daily_dsa_rate: 25000 },
  { s_no: 7, name: 'Hon. Justice Kanyi Kimondo', pj_number: '55877', daily_dsa_rate: 25000 },
  { s_no: 8, name: 'Hon. Lady Justice Cecilia W. Githua', pj_number: '16530', daily_dsa_rate: 25000 },
  { s_no: 9, name: 'Hon Lady Justice Grace Nzioka', pj_number: '15071', daily_dsa_rate: 25000 },
  { s_no: 10, name: 'Hon. Lady Justice Christine W. Meoli', pj_number: '12950', daily_dsa_rate: 25000 },
  { s_no: 11, name: 'Hon. Lady Justice Stella N. Mutuku', pj_number: '16425', daily_dsa_rate: 25000 },
  { s_no: 12, name: 'Hon. Justice James Wakiaga', pj_number: '55924', daily_dsa_rate: 25000 },
  { s_no: 13, name: 'Hon. Lady Justice Rose Ougo', pj_number: '14009', daily_dsa_rate: 25000 },
  { s_no: 14, name: 'Hon. Justice Eric Kennedy O. Ogola', pj_number: '55940', daily_dsa_rate: 25000 },
  { s_no: 15, name: 'Hon. Justice Hilary Chemitei', pj_number: '55966', daily_dsa_rate: 25000 },
  { s_no: 16, name: 'Hon. Lady Justice Roseline Korir', pj_number: '56001', daily_dsa_rate: 25000 },
  { s_no: 17, name: 'Hon. Justice Richard Mwongo', pj_number: '55990', daily_dsa_rate: 25000 },
  { s_no: 18, name: 'Hon. Justice Alfred Mabeya', pj_number: '56019', daily_dsa_rate: 25000 },
  { s_no: 19, name: 'Hon. Lady Justice Abigail Mshila', pj_number: '56027', daily_dsa_rate: 25000 },
  { s_no: 20, name: 'Hon. Justice William Musyoka', pj_number: '59326', daily_dsa_rate: 25000 },
  { s_no: 21, name: 'Hon. Lady Justice Jacqueline N. Kamau', pj_number: '59334', daily_dsa_rate: 25000 },
  { s_no: 22, name: 'Hon. Justice Ngaah Jairus', pj_number: '59342', daily_dsa_rate: 25000 },
  { s_no: 23, name: 'Hon. Justice Francis Gikonyo', pj_number: '59350', daily_dsa_rate: 25000 },
  { s_no: 24, name: 'Hon. Justice Martin Muya', pj_number: '10932', daily_dsa_rate: 25000 },
  { s_no: 25, name: 'Hon. Lady Justice Esther Maina', pj_number: '15021', daily_dsa_rate: 25000 },
  { s_no: 26, name: 'Hon. Lady Justice Lilian Mutende', pj_number: '16394', daily_dsa_rate: 25000 },
  { s_no: 27, name: 'Hon. Lady Justice Roselyne Aburili', pj_number: '65238', daily_dsa_rate: 25000 },
  { s_no: 28, name: 'Hon. Justice Robert Limo', pj_number: '65254', daily_dsa_rate: 25000 },
  { s_no: 29, name: 'Hon. Justice Charles Kariuki', pj_number: '65262', daily_dsa_rate: 25000 },
  { s_no: 30, name: 'Hon. Justice Antony Mrima', pj_number: '65270', daily_dsa_rate: 25000 },
  { s_no: 31, name: 'Hon. Lady Justice Janet Mulwa', pj_number: '65288', daily_dsa_rate: 25000 },
  { s_no: 32, name: 'Hon. Lady Justice Margaret Muigai', pj_number: '16522', daily_dsa_rate: 25000 },
  { s_no: 33, name: 'Hon. Justice Stephen Riechi', pj_number: '14156', daily_dsa_rate: 25000 },
  { s_no: 34, name: 'Hon. Justice Olga Sewe', pj_number: '13883', daily_dsa_rate: 25000 },
  { s_no: 35, name: 'Hon. Lady Justice Wilfrida Okwany', pj_number: '65408', daily_dsa_rate: 25000 },
  { s_no: 36, name: 'Hon. Justice Patrick Otieno', pj_number: '65377', daily_dsa_rate: 25000 },
  { s_no: 37, name: 'Hon. Justice Anthony Ndung\'u', pj_number: '20644', daily_dsa_rate: 25000 },
  { s_no: 38, name: 'Hon. Lady Justice Mugure Thande', pj_number: '65385', daily_dsa_rate: 25000 },
  { s_no: 39, name: 'Hon. Lady Justice Margaret Mwangi', pj_number: '65369', daily_dsa_rate: 25000 },
  { s_no: 40, name: 'Hon. Justice Stephen Githinji', pj_number: '20432', daily_dsa_rate: 25000 },
  { s_no: 41, name: 'Hon. Lady Justice Dorah O. Chepkwony', pj_number: '19732', daily_dsa_rate: 25000 },
  { s_no: 42, name: 'Hon. Lady Justice Asenath Ongeri', pj_number: '16239', daily_dsa_rate: 25000 },
  { s_no: 43, name: 'Hon. Justice Kiarie Waweru Kiarie', pj_number: '14960', daily_dsa_rate: 25000 },
  { s_no: 44, name: 'Hon. Justice Reuben Nyakundi', pj_number: '14978', daily_dsa_rate: 25000 },
  { s_no: 45, name: 'Hon. Mr. Justice John Onyiego', pj_number: '20424', daily_dsa_rate: 25000 },
  { s_no: 46, name: 'Hon. Lady Justice Thripsisa Wanjiku Cherere', pj_number: '20369', daily_dsa_rate: 25000 },
  { s_no: 47, name: 'Hon. Lady Justice Lucy Gitari', pj_number: '12926', daily_dsa_rate: 25000 },
  { s_no: 48, name: 'Hon. Mr. Justice David Kemei', pj_number: '33095', daily_dsa_rate: 25000 },
  { s_no: 49, name: 'Hon. Lady Justice Anne Colleta Onginjo', pj_number: '20555', daily_dsa_rate: 25000 },
  { s_no: 50, name: 'Hon. Lady Justice Teresia Matheka', pj_number: '20694', daily_dsa_rate: 25000 },
  { s_no: 51, name: 'Hon. Mr. Justice Jesse Nyagah', pj_number: '15013', daily_dsa_rate: 25000 },
  { s_no: 52, name: 'Hon. Lady Justice Patricia Gichohi', pj_number: '19855', daily_dsa_rate: 25000 },
  { s_no: 53, name: 'Hon. Lady Justice Josephine Mong\'are', pj_number: '81733', daily_dsa_rate: 25000 },
  { s_no: 54, name: 'Hon. Lady Justice Patricia Nyaundi', pj_number: '81732', daily_dsa_rate: 25000 },
  { s_no: 55, name: 'Hon. Lady Justice Diana Kavedza', pj_number: '20660', daily_dsa_rate: 25000 },
  { s_no: 56, name: 'Hon. Lady Justice Sophie Chirchir', pj_number: '81734', daily_dsa_rate: 25000 },
  { s_no: 57, name: 'Hon. Justice Prof. (Dr.) Nixon Sifuna', pj_number: '81737', daily_dsa_rate: 25000 },
  { s_no: 58, name: 'Hon. Lady Justice Mwanaisha Saida', pj_number: '81740', daily_dsa_rate: 25000 },
  { s_no: 59, name: 'Hon. Justice Heston Nyaga', pj_number: '39928', daily_dsa_rate: 25000 },
  { s_no: 60, name: 'Hon. Justice John Chigiti', pj_number: '81739', daily_dsa_rate: 25000 },
  { s_no: 61, name: 'Hon. Justice Peter Mulwa', pj_number: '34059', daily_dsa_rate: 25000 },
  { s_no: 62, name: 'Hon. Justice Lawrence Mugambi', pj_number: '34732', daily_dsa_rate: 25000 },
  { s_no: 63, name: 'Hon. Justice Gregory Mutai', pj_number: '81742', daily_dsa_rate: 25000 },
  { s_no: 64, name: 'Hon. Justice John Robert Wananda', pj_number: '81735', daily_dsa_rate: 25000 },
  { s_no: 65, name: 'Hon. Justice Samwel Mohochi', pj_number: '81736', daily_dsa_rate: 25000 },
  { s_no: 66, name: 'Hon. Justice Francis Rayola Olel', pj_number: '81738', daily_dsa_rate: 25000 },
  { s_no: 67, name: 'Hon. Lady Justice Dr. Githiru Freda Mugambi', pj_number: '75217-01', daily_dsa_rate: 25000 },
  { s_no: 68, name: 'Hon. Justice Dennis Kizito Magare', pj_number: '81741', daily_dsa_rate: 25000 },
  { s_no: 69, name: 'Hon. Lady Justice Florence Kabiru', pj_number: '40725', daily_dsa_rate: 25000 },
  { s_no: 70, name: 'Hon. Lady Justice Teresa Odera', pj_number: '40149', daily_dsa_rate: 25000 },
  { s_no: 71, name: 'Hon. Justice Aleem Visram', pj_number: '81744', daily_dsa_rate: 25000 },
  { s_no: 72, name: 'Hon. Mr. Justice Moses Ado', pj_number: '82773', daily_dsa_rate: 25000 },
  { s_no: 73, name: 'Hon. Lady Justice Alice Bett Soi', pj_number: '82774', daily_dsa_rate: 25000 },
  { s_no: 74, name: 'Hon. Mr. Justice Benjamin Musyoki', pj_number: '82775', daily_dsa_rate: 25000 },
  { s_no: 75, name: 'Hon. Mr. Justice John Tamar', pj_number: '20775', daily_dsa_rate: 25000 },
  { s_no: 76, name: 'Hon. Mr. Justice Francis Andayi', pj_number: '34253', daily_dsa_rate: 25000 },
  { s_no: 77, name: 'Hon. Mr. Justice Bahati Mwamuye', pj_number: '82768', daily_dsa_rate: 25000 },
  { s_no: 78, name: 'Hon. Mr. Justice Julius Ng\'arng\'ar', pj_number: '33147', daily_dsa_rate: 25000 },
  { s_no: 79, name: 'Hon. Lady Justice Wendy Micheni', pj_number: '33192', daily_dsa_rate: 25000 },
  { s_no: 80, name: 'Hon. Lady Justice Emily Ominde', pj_number: '19871', daily_dsa_rate: 25000 },
  { s_no: 81, name: 'Hon. Lady Justice Helene Namisi', pj_number: '82769', daily_dsa_rate: 25000 },
  { s_no: 82, name: 'Hon. Mr. Justice Alexander Muteti', pj_number: '82772', daily_dsa_rate: 25000 },
  { s_no: 83, name: 'Hon. Mr. Justice Julius Nangea', pj_number: '33710', daily_dsa_rate: 25000 },
  { s_no: 84, name: 'Hon. Mr. Justice Benjamin Njoroge', pj_number: '82770', daily_dsa_rate: 25000 },
  { s_no: 85, name: 'Hon. Lady Justice Caroline Kendagor', pj_number: '52227', daily_dsa_rate: 25000 },
  { s_no: 86, name: 'Hon. Mr. Justice Stephen Mbungi', pj_number: '21755', daily_dsa_rate: 25000 },
  { s_no: 87, name: 'Hon. Mr. Justice Linus Kassan', pj_number: '40181', daily_dsa_rate: 25000 },
  { s_no: 88, name: 'Hon. Lady Justice Noel Adagi', pj_number: '82767', daily_dsa_rate: 25000 },
  { s_no: 89, name: 'Hon. Lady Justice Tabitha Wanyama', pj_number: '82766', daily_dsa_rate: 25000 },
  { s_no: 90, name: 'Hon. Lady Justice Rhoda Rutto', pj_number: '61315', daily_dsa_rate: 25000 },
  { s_no: 91, name: 'Hon. Mr. Justice Joe Omido', pj_number: '43294', daily_dsa_rate: 25000 },
  { s_no: 92, name: 'Hon. Justice Robinson Ondieki', pj_number: '40482', daily_dsa_rate: 25000 },
  { s_no: 93, name: 'Hon. Lady Justice Joyce Gandani', pj_number: '39504', daily_dsa_rate: 25000 },
  { s_no: 94, name: 'Hon. Justice Joseph Were', pj_number: '33257', daily_dsa_rate: 25000 },
  { s_no: 95, name: 'Hon. Lady Justice Roseline Oganyo', pj_number: '21674', daily_dsa_rate: 25000 },
  { s_no: 96, name: 'Hon. Justice Paul Rotich', pj_number: '42002', daily_dsa_rate: 25000 },
  { s_no: 97, name: 'Hon. Justice Dickson Odhiambo Onyango', pj_number: '39936', daily_dsa_rate: 25000 },
  { s_no: 98, name: 'Hon. Justice Alex Kimanzi Ithuku', pj_number: '39944', daily_dsa_rate: 25000 },
  { s_no: 99, name: 'Hon. Lady Justice Martha Wanzila Mutuku', pj_number: '38980', daily_dsa_rate: 25000 },
  { s_no: 100, name: 'Hon. Justice Benard Wafula Murunga', pj_number: '83931', daily_dsa_rate: 25000 },
  { s_no: 101, name: 'Hon. Justice Francis Nyungu Kyambia', pj_number: '40814', daily_dsa_rate: 25000 },
  { s_no: 102, name: 'Hon. Lady Justice Letizia Muthoni Wachira', pj_number: '40212', daily_dsa_rate: 25000 },
  { s_no: 103, name: 'Hon. Justice Kennedy Lenkamai Kandet', pj_number: '38883', daily_dsa_rate: 25000 },
  { s_no: 104, name: 'Hon. Justice Richard Kipkemoi Koech', pj_number: '49834', daily_dsa_rate: 25000 },
  { s_no: 105, name: 'Hon. Justice Emmanuel Omondi Bitta', pj_number: '83917', daily_dsa_rate: 25000 },
  { s_no: 106, name: 'Hon. Justice David Wanjohi Mburu', pj_number: '43278', daily_dsa_rate: 25000 },
  { s_no: 107, name: 'Hon. Justice Dominic Kipkemoi Rono', pj_number: '82801', daily_dsa_rate: 25000 },
  { s_no: 108, name: 'Hon. Lady Justice Winnie Narasha Molonko', pj_number: '83924', daily_dsa_rate: 25000 },
  { s_no: 109, name: 'Hon. Lady Justice Judith Chelangat Mutai', pj_number: '83922', daily_dsa_rate: 25000 },
  { s_no: 110, name: 'Hon. Justice Joseph Kipkoech Biomdo', pj_number: '83921', daily_dsa_rate: 25000 },
  { s_no: 111, name: 'Hon. Lady Justice Anne Mary Okutoyi', pj_number: '83925', daily_dsa_rate: 25000 },
  { s_no: 112, name: 'Hon. Justice Abdi Mohamud Hassan', pj_number: '83918', daily_dsa_rate: 25000 },
  { s_no: 113, name: 'Hon. Justice Dr. Nabil Orina', pj_number: '83923', daily_dsa_rate: 25000 },
  { s_no: 114, name: 'Hon. Lady Justice Patricia Leparashao', pj_number: '83920', daily_dsa_rate: 25000 },
  { s_no: 115, name: 'Hon. Lady Justice Catherine Kassim', pj_number: '83926', daily_dsa_rate: 25000 },
];

export async function seedJudges(): Promise<void> {
  console.log('🌱 Seeding judges table...');

  try {
    // Clear existing data (optional - comment out if you want to keep existing)
    await pool.query('TRUNCATE TABLE judges RESTART IDENTITY CASCADE');
    console.log('✅ Cleared existing judges data');

    let insertedCount = 0;
    let skippedCount = 0;

    for (const judge of judges) {
      // Check if judge already exists by pj_number
      const { rows: existing } = await pool.query(
        'SELECT id FROM judges WHERE pj_number = $1',
        [judge.pj_number]
      );

      if (existing.length > 0) {
        // Update existing judge with latest data
        await pool.query(
          `UPDATE judges 
           SET s_no = $1, name = $2, daily_dsa_rate = $3, updated_at = NOW()
           WHERE pj_number = $4`,
          [judge.s_no, judge.name, judge.daily_dsa_rate, judge.pj_number]
        );
        skippedCount++;
        console.log(`🔄 Updated judge #${judge.s_no}: ${judge.name}`);
      } else {
        // Insert new judge
        await pool.query(
          `INSERT INTO judges (s_no, name, pj_number, daily_dsa_rate)
           VALUES ($1, $2, $3, $4)`,
          [judge.s_no, judge.name, judge.pj_number, judge.daily_dsa_rate]
        );
        insertedCount++;
        console.log(`✅ Inserted judge #${judge.s_no}: ${judge.name}`);
      }
    }

    console.log(`✅ Seeding complete! Inserted: ${insertedCount}, Updated: ${skippedCount}`);
    console.log(`📊 Total judges in database: ${judges.length}`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedJudges()
    .then(() => {
      console.log('Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}