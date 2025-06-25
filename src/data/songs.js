const songsData = [
  {
    "id": 1,
    "name": "Moonlight Sonata",
    "description": "A vibrant and energetic composition.",
    "type": "Balettlåt",
    "status": "Aktiv",
    "recordings": [
      {
        "name": "Moonlight Sonata Recording 1",
        "album": "Romantic Moods",
        "date": "2010-05-30",
        "file": "/swing_that_music.mp3",
        "tags": [
          "live",
          "remastered"
        ],
        "description": "Recording description here."
      },
      {
        "name": "Moonlight Sonata Recording 2",
        "album": "Symphonic Legends",
        "date": "2012-03-20",
        "file": "moonlight_sonata_rec2.mp3",
        "tags": [
          "live",
          "remastered",
          "classic"
        ],
        "description": "Recording description here."
      },
      {
        "name": "Moonlight Sonata Recording 3",
        "album": "Romantic Moods",
        "date": "1978-05-20",
        "file": "moonlight_sonata_rec3.mp3",
        "tags": [
          "studio"
        ],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Flute",
        "file": "/LiTHe_Blås_stadgar.pdf",
        "date": "1982-03-04",
        "tags": [
          "original"
        ],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Cello",
        "file": "moonlight_sonata_sheet2.pdf",
        "date": "1984-11-25",
        "tags": [],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Piano",
        "file": "moonlight_sonata_sheet3.pdf",
        "date": "1986-12-14",
        "tags": [
          "original"
        ],
        "description": "Sheet music description here."
      }
    ]
  },
  {
    "id": 2,
    "name": "Imagine",
    "description": "A timeless melody.",
    "type": "Balettlåt",
    "status": "Gammal",
    "recordings": [
      {
        "name": "Imagine Recording 1",
        "album": "Symphonic Legends",
        "date": "1971-07-26",
        "file": "imagine_rec1.mp3",
        "tags": [
          "remastered",
          "2020"
        ],
        "description": "Recording description here."
      },
      {
        "name": "Imagine Recording 2",
        "album": "Live in Vienna",
        "date": "2023-02-05",
        "file": "imagine_rec2.mp3",
        "tags": [],
        "description": "Recording description here."
      },
      {
        "name": "Imagine Recording 3",
        "album": "Ballet Favorites",
        "date": "2019-06-17",
        "file": "imagine_rec3.mp3",
        "tags": [
          "live",
          "2020"
        ],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Piano",
        "file": "imagine_sheet1.pdf",
        "date": "1976-01-06",
        "tags": [
          "original",
          "simplified"
        ],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Violin",
        "file": "imagine_sheet2.pdf",
        "date": "2017-01-04",
        "tags": [
          "original",
          "annotated"
        ],
        "description": "Sheet music description here."
      }
    ]
  },
  {
    "id": 3,
    "name": "Clair de Lune",
    "description": "A timeless melody.",
    "type": "Balettlåt",
    "status": "Aktiv",
    "recordings": [
      {
        "name": "Clair de Lune Recording 1",
        "album": "Live in Vienna",
        "date": "2022-04-18",
        "file": "clair_de_lune_rec1.mp3",
        "tags": [
          "remastered",
          "live"
        ],
        "description": "Recording description here."
      },
      {
        "name": "Clair de Lune Recording 2",
        "album": "Ballet Favorites",
        "date": "1997-02-10",
        "file": "clair_de_lune_rec2.mp3",
        "tags": [],
        "description": "Recording description here."
      },
      {
        "name": "Clair de Lune Recording 3",
        "album": "Classics Vol.1",
        "date": "2006-11-16",
        "file": "clair_de_lune_rec3.mp3",
        "tags": [
          "2020",
          "remastered",
          "studio"
        ],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Violin",
        "file": "clair_de_lune_sheet1.pdf",
        "date": "2012-02-04",
        "tags": [
          "original"
        ],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Violin",
        "file": "clair_de_lune_sheet2.pdf",
        "date": "2008-07-23",
        "tags": [],
        "description": "Sheet music description here."
      }
    ]
  },
  {
    "id": 4,
    "name": "Bohemian Rhapsody",
    "description": "A dramatic orchestral work.",
    "type": "Orkesterlåt",
    "status": "Aktiv",
    "recordings": [
      {
        "name": "Bohemian Rhapsody Recording 1",
        "album": "Symphonic Legends",
        "date": "1976-03-26",
        "file": "bohemian_rhapsody_rec1.mp3",
        "tags": [
          "classic",
          "live",
          "2020"
        ],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Guitar",
        "file": "bohemian_rhapsody_sheet1.pdf",
        "date": "1987-10-10",
        "tags": [
          "annotated",
          "original"
        ],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Guitar",
        "file": "bohemian_rhapsody_sheet2.pdf",
        "date": "2010-09-08",
        "tags": [
          "original"
        ],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Violin",
        "file": "bohemian_rhapsody_sheet3.pdf",
        "date": "1997-07-11",
        "tags": [
          "original",
          "annotated"
        ],
        "description": "Sheet music description here."
      }
    ]
  },
  {
    "id": 5,
    "name": "Swan Lake",
    "description": "A beautiful classical piece.",
    "type": "Orkesterlåt",
    "status": "Aktiv",
    "recordings": [
      {
        "name": "Swan Lake Recording 1",
        "album": "Ballet Favorites",
        "date": "1973-11-06",
        "file": "swan_lake_rec1.mp3",
        "tags": [
          "studio",
          "remastered",
          "live"
        ],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Piano",
        "file": "swan_lake_sheet1.pdf",
        "date": "2004-02-19",
        "tags": [],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Guitar",
        "file": "swan_lake_sheet2.pdf",
        "date": "1972-01-16",
        "tags": [
          "simplified",
          "original"
        ],
        "description": "Sheet music description here."
      }
    ]
  },
  {
    "id": 6,
    "name": "F\u00fcr Elise",
    "description": "A peaceful and reflective tune.",
    "type": "Orkesterlåt",
    "status": "Gammal",
    "recordings": [
      {
        "name": "F\u00fcr Elise Recording 1",
        "album": "Classics Vol.1",
        "date": "1984-01-22",
        "file": "f\u00fcr_elise_rec1.mp3",
        "tags": [
          "2020"
        ],
        "description": "Recording description here."
      },
      {
        "name": "F\u00fcr Elise Recording 2",
        "album": "Classics Vol.1",
        "date": "2012-10-07",
        "file": "f\u00fcr_elise_rec2.mp3",
        "tags": [],
        "description": "Recording description here."
      },
      {
        "name": "F\u00fcr Elise Recording 3",
        "album": "Live in Vienna",
        "date": "2008-02-26",
        "file": "f\u00fcr_elise_rec3.mp3",
        "tags": [],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Guitar",
        "file": "f\u00fcr_elise_sheet1.pdf",
        "date": "1998-10-09",
        "tags": [],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Piano",
        "file": "f\u00fcr_elise_sheet2.pdf",
        "date": "1997-03-01",
        "tags": [
          "simplified",
          "original"
        ],
        "description": "Sheet music description here."
      }
    ]
  },
  {
    "id": 7,
    "name": "Nocturne Op.9 No.2",
    "description": "A peaceful and reflective tune.",
    "type": "Orkesterlåt",
    "status": "Gammal",
    "recordings": [
      {
        "name": "Nocturne Op.9 No.2 Recording 1",
        "album": "Romantic Moods",
        "date": "2004-05-15",
        "file": "nocturne_op.9_no.2_rec1.mp3",
        "tags": [],
        "description": "Recording description here."
      },
      {
        "name": "Nocturne Op.9 No.2 Recording 2",
        "album": "Live in Vienna",
        "date": "2014-10-05",
        "file": "nocturne_op.9_no.2_rec2.mp3",
        "tags": [
          "live"
        ],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Guitar",
        "file": "nocturne_op.9_no.2_sheet1.pdf",
        "date": "1999-04-18",
        "tags": [],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Piano",
        "file": "nocturne_op.9_no.2_sheet2.pdf",
        "date": "1999-10-12",
        "tags": [
          "annotated",
          "simplified"
        ],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Cello",
        "file": "nocturne_op.9_no.2_sheet3.pdf",
        "date": "1982-06-05",
        "tags": [
          "simplified"
        ],
        "description": "Sheet music description here."
      }
    ]
  },
  {
    "id": 8,
    "name": "The Planets",
    "description": "A romantic piano solo.",
    "type": "Balettlåt",
    "status": "Gammal",
    "recordings": [
      {
        "name": "The Planets Recording 1",
        "album": "Symphonic Legends",
        "date": "1991-04-21",
        "file": "the_planets_rec1.mp3",
        "tags": [
          "2020",
          "live"
        ],
        "description": "Recording description here."
      },
      {
        "name": "The Planets Recording 2",
        "album": "Symphonic Legends",
        "date": "1995-06-27",
        "file": "the_planets_rec2.mp3",
        "tags": [],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Piano",
        "file": "the_planets_sheet1.pdf",
        "date": "1996-02-09",
        "tags": [
          "annotated"
        ],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Cello",
        "file": "the_planets_sheet2.pdf",
        "date": "2012-01-16",
        "tags": [
          "original",
          "simplified"
        ],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Cello",
        "file": "the_planets_sheet3.pdf",
        "date": "1978-06-29",
        "tags": [
          "annotated"
        ],
        "description": "Sheet music description here."
      }
    ]
  },
  {
    "id": 9,
    "name": "Bol\u00e9ro",
    "description": "A timeless melody.",
    "type": "Orkesterlåt",
    "status": "Aktiv",
    "recordings": [
      {
        "name": "Bol\u00e9ro Recording 1",
        "album": "Symphonic Legends",
        "date": "2009-09-19",
        "file": "bol\u00e9ro_rec1.mp3",
        "tags": [],
        "description": "Recording description here."
      },
      {
        "name": "Bol\u00e9ro Recording 2",
        "album": "Romantic Moods",
        "date": "2012-06-30",
        "file": "bol\u00e9ro_rec2.mp3",
        "tags": [
          "studio"
        ],
        "description": "Recording description here."
      },
      {
        "name": "Bol\u00e9ro Recording 3",
        "album": "Live in Vienna",
        "date": "2009-09-04",
        "file": "bol\u00e9ro_rec3.mp3",
        "tags": [
          "2020",
          "live"
        ],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Piano",
        "file": "bol\u00e9ro_sheet1.pdf",
        "date": "2016-02-14",
        "tags": [
          "simplified"
        ],
        "description": "Sheet music description here."
      }
    ]
  },
  {
    "id": 10,
    "name": "The Nutcracker",
    "description": "A timeless melody.",
    "type": "Balettlåt",
    "status": "Gammal",
    "recordings": [
      {
        "name": "The Nutcracker Recording 1",
        "album": "Romantic Moods",
        "date": "2010-10-25",
        "file": "the_nutcracker_rec1.mp3",
        "tags": [],
        "description": "Recording description here."
      },
      {
        "name": "The Nutcracker Recording 2",
        "album": "Classics Vol.1",
        "date": "2018-03-05",
        "file": "the_nutcracker_rec2.mp3",
        "tags": [
          "remastered",
          "live"
        ],
        "description": "Recording description here."
      },
      {
        "name": "The Nutcracker Recording 3",
        "album": "Symphonic Legends",
        "date": "2016-12-17",
        "file": "the_nutcracker_rec3.mp3",
        "tags": [
          "remastered",
          "live"
        ],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Guitar",
        "file": "the_nutcracker_sheet1.pdf",
        "date": "1999-07-28",
        "tags": [
          "original"
        ],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Flute",
        "file": "the_nutcracker_sheet2.pdf",
        "date": "2017-12-11",
        "tags": [
          "annotated",
          "original"
        ],
        "description": "Sheet music description here."
      }
    ]
  },
  {
    "id": 11,
    "name": "Canon in D",
    "description": "A peaceful and reflective tune.",
    "type": "Balettlåt",
    "status": "Aktiv",
    "recordings": [
      {
        "name": "Canon in D Recording 1",
        "album": "Classics Vol.1",
        "date": "2014-12-16",
        "file": "canon_in_d_rec1.mp3",
        "tags": [
          "live",
          "studio",
          "classic"
        ],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Flute",
        "file": "canon_in_d_sheet1.pdf",
        "date": "1983-08-16",
        "tags": [],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Cello",
        "file": "canon_in_d_sheet2.pdf",
        "date": "1974-01-13",
        "tags": [
          "simplified"
        ],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Flute",
        "file": "canon_in_d_sheet3.pdf",
        "date": "1976-10-03",
        "tags": [],
        "description": "Sheet music description here."
      }
    ]
  },
  {
    "id": 12,
    "name": "Symphony No.5",
    "description": "A dramatic orchestral work.",
    "type": "Orkesterlåt",
    "status": "Aktiv",
    "recordings": [
      {
        "name": "Symphony No.5 Recording 1",
        "album": "Symphonic Legends",
        "date": "1976-05-08",
        "file": "symphony_no.5_rec1.mp3",
        "tags": [
          "remastered",
          "2020"
        ],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Cello",
        "file": "symphony_no.5_sheet1.pdf",
        "date": "1987-11-21",
        "tags": [
          "original"
        ],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Flute",
        "file": "symphony_no.5_sheet2.pdf",
        "date": "2017-08-17",
        "tags": [],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Flute",
        "file": "symphony_no.5_sheet3.pdf",
        "date": "1981-12-26",
        "tags": [
          "original",
          "simplified"
        ],
        "description": "Sheet music description here."
      }
    ]
  },
  {
    "id": 13,
    "name": "Rhapsody in Blue",
    "description": "A romantic piano solo.",
    "type": "Balettlåt",
    "status": "Aktiv",
    "recordings": [
      {
        "name": "Rhapsody in Blue Recording 1",
        "album": "Live in Vienna",
        "date": "1972-07-31",
        "file": "rhapsody_in_blue_rec1.mp3",
        "tags": [
          "classic"
        ],
        "description": "Recording description here."
      },
      {
        "name": "Rhapsody in Blue Recording 2",
        "album": "Live in Vienna",
        "date": "1970-04-30",
        "file": "rhapsody_in_blue_rec2.mp3",
        "tags": [
          "classic"
        ],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Flute",
        "file": "rhapsody_in_blue_sheet1.pdf",
        "date": "1991-06-19",
        "tags": [
          "annotated",
          "simplified"
        ],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Cello",
        "file": "rhapsody_in_blue_sheet2.pdf",
        "date": "2005-02-18",
        "tags": [],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Cello",
        "file": "rhapsody_in_blue_sheet3.pdf",
        "date": "2014-10-30",
        "tags": [
          "original"
        ],
        "description": "Sheet music description here."
      }
    ]
  },
  {
    "id": 14,
    "name": "Peer Gynt",
    "description": "A vibrant and energetic composition.",
    "type": "Orkesterlåt",
    "status": "Aktiv",
    "recordings": [
      {
        "name": "Peer Gynt Recording 1",
        "album": "Ballet Favorites",
        "date": "2022-04-19",
        "file": "peer_gynt_rec1.mp3",
        "tags": [
          "remastered",
          "live",
          "studio"
        ],
        "description": "Recording description here."
      },
      {
        "name": "Peer Gynt Recording 2",
        "album": "Ballet Favorites",
        "date": "1990-04-25",
        "file": "peer_gynt_rec2.mp3",
        "tags": [
          "live",
          "2020",
          "classic"
        ],
        "description": "Recording description here."
      },
      {
        "name": "Peer Gynt Recording 3",
        "album": "Ballet Favorites",
        "date": "1980-08-31",
        "file": "peer_gynt_rec3.mp3",
        "tags": [
          "live"
        ],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Cello",
        "file": "peer_gynt_sheet1.pdf",
        "date": "2017-11-03",
        "tags": [],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Cello",
        "file": "peer_gynt_sheet2.pdf",
        "date": "2005-05-25",
        "tags": [
          "simplified"
        ],
        "description": "Sheet music description here."
      }
    ]
  },
  {
    "id": 15,
    "name": "The Four Seasons",
    "description": "A ballet masterpiece.",
    "type": "Orkesterlåt",
    "status": "Aktiv",
    "recordings": [
      {
        "name": "The Four Seasons Recording 1",
        "album": "Romantic Moods",
        "date": "1993-10-06",
        "file": "the_four_seasons_rec1.mp3",
        "tags": [
          "studio"
        ],
        "description": "Recording description here."
      },
      {
        "name": "The Four Seasons Recording 2",
        "album": "Ballet Favorites",
        "date": "2009-04-17",
        "file": "the_four_seasons_rec2.mp3",
        "tags": [
          "live",
          "studio",
          "classic"
        ],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Piano",
        "file": "the_four_seasons_sheet1.pdf",
        "date": "2013-05-19",
        "tags": [
          "annotated",
          "simplified"
        ],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Violin",
        "file": "the_four_seasons_sheet2.pdf",
        "date": "1975-03-15",
        "tags": [
          "original"
        ],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Piano",
        "file": "the_four_seasons_sheet3.pdf",
        "date": "2008-11-20",
        "tags": [
          "original",
          "simplified"
        ],
        "description": "Sheet music description here."
      }
    ]
  },
  {
    "id": 16,
    "name": "Gymnop\u00e9die No.1",
    "description": "A timeless melody.",
    "type": "Orkesterlåt",
    "status": "Aktiv",
    "recordings": [
      {
        "name": "Gymnop\u00e9die No.1 Recording 1",
        "album": "Ballet Favorites",
        "date": "1979-06-05",
        "file": "gymnop\u00e9die_no.1_rec1.mp3",
        "tags": [],
        "description": "Recording description here."
      },
      {
        "name": "Gymnop\u00e9die No.1 Recording 2",
        "album": "Classics Vol.1",
        "date": "2016-09-07",
        "file": "gymnop\u00e9die_no.1_rec2.mp3",
        "tags": [],
        "description": "Recording description here."
      },
      {
        "name": "Gymnop\u00e9die No.1 Recording 3",
        "album": "Romantic Moods",
        "date": "1999-08-29",
        "file": "gymnop\u00e9die_no.1_rec3.mp3",
        "tags": [
          "classic"
        ],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Violin",
        "file": "gymnop\u00e9die_no.1_sheet1.pdf",
        "date": "2019-02-01",
        "tags": [
          "simplified",
          "annotated"
        ],
        "description": "Sheet music description here."
      }
    ]
  },
  {
    "id": 17,
    "name": "Blue Danube",
    "description": "A dramatic orchestral work.",
    "type": "Orkesterlåt",
    "status": "Aktiv",
    "recordings": [
      {
        "name": "Blue Danube Recording 1",
        "album": "Romantic Moods",
        "date": "1993-11-09",
        "file": "blue_danube_rec1.mp3",
        "tags": [
          "2020",
          "live"
        ],
        "description": "Recording description here."
      },
      {
        "name": "Blue Danube Recording 2",
        "album": "Symphonic Legends",
        "date": "2023-12-03",
        "file": "blue_danube_rec2.mp3",
        "tags": [],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Violin",
        "file": "blue_danube_sheet1.pdf",
        "date": "2020-07-12",
        "tags": [],
        "description": "Sheet music description here."
      }
    ]
  },
  {
    "id": 18,
    "name": "Carmen Suite",
    "description": "A vibrant and energetic composition.",
    "type": "Balettlåt",
    "status": "Aktiv",
    "recordings": [
      {
        "name": "Carmen Suite Recording 1",
        "album": "Symphonic Legends",
        "date": "1970-05-30",
        "file": "carmen_suite_rec1.mp3",
        "tags": [
          "remastered"
        ],
        "description": "Recording description here."
      },
      {
        "name": "Carmen Suite Recording 2",
        "album": "Live in Vienna",
        "date": "1990-11-30",
        "file": "carmen_suite_rec2.mp3",
        "tags": [],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Cello",
        "file": "carmen_suite_sheet1.pdf",
        "date": "1986-08-14",
        "tags": [],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Flute",
        "file": "carmen_suite_sheet2.pdf",
        "date": "1986-07-10",
        "tags": [],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Piano",
        "file": "carmen_suite_sheet3.pdf",
        "date": "1987-06-16",
        "tags": [],
        "description": "Sheet music description here."
      }
    ]
  },
  {
    "id": 19,
    "name": "Pictures at an Exhibition",
    "description": "A peaceful and reflective tune.",
    "type": "Orkesterlåt",
    "status": "Gammal",
    "recordings": [
      {
        "name": "Pictures at an Exhibition Recording 1",
        "album": "Ballet Favorites",
        "date": "1993-07-09",
        "file": "pictures_at_an_exhibition_rec1.mp3",
        "tags": [
          "classic",
          "2020",
          "live"
        ],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Flute",
        "file": "pictures_at_an_exhibition_sheet1.pdf",
        "date": "2002-09-11",
        "tags": [
          "annotated"
        ],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Flute",
        "file": "pictures_at_an_exhibition_sheet2.pdf",
        "date": "1997-05-12",
        "tags": [
          "annotated"
        ],
        "description": "Sheet music description here."
      },
      {
        "instrument": "Cello",
        "file": "pictures_at_an_exhibition_sheet3.pdf",
        "date": "2017-09-03",
        "tags": [
          "annotated"
        ],
        "description": "Sheet music description here."
      }
    ]
  },
  {
    "id": 20,
    "name": "Adagio for Strings",
    "description": "A ballet masterpiece.",
    "type": "Balettlåt",
    "status": "Gammal",
    "recordings": [
      {
        "name": "Adagio for Strings Recording 1",
        "album": "Romantic Moods",
        "date": "2016-03-04",
        "file": "adagio_for_strings_rec1.mp3",
        "tags": [
          "studio",
          "classic"
        ],
        "description": "Recording description here."
      },
      {
        "name": "Adagio for Strings Recording 2",
        "album": "Romantic Moods",
        "date": "1986-09-20",
        "file": "adagio_for_strings_rec2.mp3",
        "tags": [],
        "description": "Recording description here."
      }
    ],
    "sheetMusic": [
      {
        "instrument": "Piano",
        "file": "adagio_for_strings_sheet1.pdf",
        "date": "1986-05-06",
        "tags": [
          "original"
        ],
        "description": "Sheet music description here."
      }
    ]
  }
];

export default songsData;