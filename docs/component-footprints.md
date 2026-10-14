# Component footprints

The perfboard grid uses a 2.54 mm (0.1 inch) hole pitch. Catalog footprints describe the holes used by the selected through-hole package. Package drawings and pin labels should be checked against the exact part being fitted; surface-mount variants use different footprints.

## Named DIP presets

These parts use 2.54 mm pin pitch and 7.62 mm (0.3 inch) spacing between the two pin rows. In `IcDefinition`, this is `widthPin: 4`; `heightPin` is half the total pin count. Pins are numbered counterclockwise from pin 1, viewed from above with the orientation mark at the top.

| Catalog part | Through-hole package | Pins per row | Pinout and package reference |
| --- | --- | --- | --- |
| LM358 Dual Op Amp | PDIP-8 | 4 | [Texas Instruments LM358 datasheet](https://www.ti.com/lit/ds/symlink/lm358.pdf), pin configuration and P package mechanical drawing |
| LM386 Audio Amplifier | PDIP-8 | 4 | [Texas Instruments LM386 datasheet](https://www.ti.com/lit/ds/symlink/lm386.pdf), pin functions and P (R-PDIP-T8) mechanical drawing |
| PC817 Optocoupler | DIP-4 | 2 | [Sharp PC817XxNSZ1B datasheet](https://global.sharp/products/device/lineup/data/pdf/datasheet/PC817XxNSZ1B_e.pdf), internal connection diagram and through-hole outline on page 2 |
| ULN2803A Darlington Driver | DIP-18 | 9 | [STMicroelectronics ULN2803A datasheet](https://www.st.com/resource/en/datasheet/uln2803a.pdf), top-view pin connections on page 4 and package drawing on page 12; [onsemi ULN2803 package dimensions](https://www.onsemi.com/download/data-sheet/pdf/uln2803-d.pdf), 7.62 mm formed lead-row spacing |
| 74HC595 Shift Register | PDIP-16 | 8 | [Texas Instruments SN74HC595 datasheet](https://www.ti.com/lit/ds/symlink/sn74hc595.pdf), pin functions and N package mechanical drawing |
| ATtiny85 | PDIP-8 | 4 | [Microchip ATtiny25/45/85 datasheet](https://ww1.microchip.com/downloads/en/devicedoc/atmel-2586-avr-8-bit-microcontroller-attiny25-attiny45-attiny85_datasheet.pdf), pin configurations |
| LM393 Dual Comparator | PDIP-8 | 4 | [Texas Instruments LM393 datasheet](https://www.ti.com/lit/ds/symlink/lm393.pdf), pin configuration |
| TL072 Dual JFET Op Amp | PDIP-8 | 4 | [Texas Instruments TL072 datasheet](https://www.ti.com/lit/ds/symlink/tl072.pdf), P package pin configuration |
| 4N35 Optocoupler | DIP-6 | 3 | [Vishay 4N35 datasheet](https://www.vishay.com/docs/81181/4n35.pdf), pin diagram |
| 6N137 High-Speed Optocoupler | DIP-8 | 4 | [Vishay 6N137 datasheet](https://www.vishay.com/docs/84732/6n137.pdf), pin diagram |
| NE556 Dual Timer | PDIP-14 | 7 | [Texas Instruments NE556 datasheet](https://www.ti.com/lit/ds/symlink/ne556.pdf), pin configuration |
| L293D Motor Driver | PDIP-16 | 8 | [Texas Instruments L293 datasheet](https://www.ti.com/lit/ds/symlink/l293.pdf), NE package pin configuration |
| CD4017 Decade Counter | PDIP-16 | 8 | [Texas Instruments CD4017B datasheet](https://www.ti.com/lit/ds/symlink/cd4017b.pdf), terminal assignment |
| 74HC14 Schmitt Inverter | PDIP-14 | 7 | [Texas Instruments SN74HC14 datasheet](https://www.ti.com/lit/ds/symlink/sn74hc14.pdf), pin configuration |

All pins are labelled. On the PC817, pins 1–4 are `A` (anode), `K` (cathode), `E` (emitter), and `C` (collector); these short labels remain readable when rotated. On the 74HC595, `/SRCLR` and `/OE` indicate active-low inputs, and `QH'` is the serial output. On the ULN2803A, `1B` through `8B` are the driver inputs, `1C` through `8C` are their collector outputs, and `COM` is the clamp-diode common connection.

On the NE556, the trailing `1` or `2` names the timer (`DIS` discharge, `THR` threshold, `CTL` control voltage, `RST` reset, `TRG` trigger). On the L293D, `VCC1` is the logic supply and `VCC2` the motor supply; its four center `GND` pins also carry heat away and should all be soldered to ground. On the CD4017, `/EN` is the active-low clock inhibit (TI calls it CLOCK INHIBIT) and `CO` the carry out. On the 6N137, `VE` is the output enable.

The shared 2D IC renderer and 3D DIP renderer draw the selected number of pins, orientation mark, and labels. The 3D bodies are representative package shapes rather than manufacturer CAD models.

## Connectors, controls, and outputs

| Catalog part | Hole layout | Package reference and assumptions |
| --- | --- | --- |
| Screw terminals, 2-pin and 3-pin | One row, 5.08 mm pitch | Generic compact terminal block; [Phoenix Contact MKDS 1,5](https://www.phoenixcontact.com/en-pc/products/pcb-terminal-block-mkds-15-2-508-bd-erd-1578859) documents this linear pin pitch. The green housing is representative, not an exact MKDS body. 5.00 mm and 3.50 mm variants use different pitches. |
| Push Button | Four holes on a 7.62 × 5.08 mm rectangle | [C&K KSA, manual insertion without ground terminal](https://www.ckswitches.com/media/1457/ksa_ksl.pdf), KSA0M; 9 × 7.6 mm body and 4.75 mm actuator height. Canvas numbers identify the four placement holes. |
| Slide Switch | Three inline pins formed to 2.54 mm pitch | [C&K JS102011CQN](https://www.ckswitches.com/media/1422/js.pdf), SPDT, 8.5 × 3.5 mm body. Its original pitch is 2.50 mm; the catalog footprint assumes leads adjusted to the grid. The middle pin is common. |
| Trimmer Potentiometer | Three inline pins, 2.54 mm pitch | [Bourns 3296W](https://bourns.com/docs/product-datasheets/3296.pdf), top adjustment, approximately 9.53 × 4.83 mm body; pin 1 CCW, pin 2 wiper, pin 3 CW. Other 3296 terminal styles have different layouts. |
| Female Header | User-selected rows and columns, 2.54 mm pitch | Generic square socket tiles; click opposite corners to size, as with male headers. |
| Jumper Cap | Two adjacent holes, 2.54 mm pitch | Generic shunt over a two-pin male header. The model includes its supporting pins; place this part instead of another header on those holes. |
| Buzzer | Two pins formed to 5.08 mm spacing | [Same Sky CEM-1206S](https://www.sameskydevices.com/product/resource/cem-1206s.pdf) provides the representative 12 mm diameter, 9.5 mm high magnetic transducer body. Its original pin spacing is 6.50 mm; the grid footprint assumes formed leads. `+` marks the positive terminal. |
| Relay | G5V-2 eight-pin DIL layout, 7.62 mm between rows | [Omron G5V-2](https://omronfs.omron.com/en_US/ecb/products/pdf/en-g5v_2.pdf), dimension and internal connection drawing, page 4. Along each row, gaps are 7.62, 5.08, and 5.08 mm; the body is approximately 20.5 × 10.1 mm. |
| RGB LEDs | Four inline pins formed to 2.54 mm pitch | 5 mm LED with leads spread from 1.27 mm package pitch; the visible labels follow SparkFun's [common-cathode COM-00105](https://www.sparkfun.com/led-rgb-clear-common-cathode.html) and [common-anode COM-10820](https://www.sparkfun.com/led-rgb-clear-common-anode.html): red, common, green, blue. `K` means common cathode; `A` means common anode. |

The relay footprint is viewed from the component side. Its pin-1 anchor is at the lower left, and the other row extends three grid holes above it before rotation. Pins 1 and 16 are the coil, 4 and 13 are common, 6 and 11 are normally closed, and 8 and 9 are normally open. Relay labels retain the manufacturer's nonconsecutive pin numbers.

Parts named **formed** describe a planned lead arrangement after bending the pins to match the perfboard grid. They do not claim that the unmodified package has a 2.54 mm or 5.08 mm pitch. The 2D artwork and 3D models show representative housings; the pin positions define the board connections.

## Timing, sensors, protection, displays, and controls

| Catalog part | Hole layout | Package reference and assumptions |
| --- | --- | --- |
| Quartz Crystal | Two pins formed to 5.08 mm spacing | HC-49/US low-profile can, about 11.4 × 4.65 mm. Its leads are 4.88 mm apart, so the grid footprint assumes they are spread slightly. The value is free text, such as `16MHz`. |
| Ceramic Resonator | Three inline pins formed to 2.54 mm pitch | [Murata CSTLS](https://www.murata.com/en-global/products/timingdevice/ceralock) three-terminal resonator with built-in load capacitors; pins are `OUT`, `GND`, `IN`. Its original pitch is 2.5 mm. |
| Photoresistor | Two pins formed to 5.08 mm spacing | Representative 5 mm CdS cell (e.g. Advanced Photonix PDV-P8103). Lead spacing varies by maker; the value is free text, such as `GL5528` or `10kΩ`. |
| NTC Thermistor | Two adjacent holes, 2.54 mm pitch | Vishay NTCLE100E3 radial bead with 2.54 mm lead spacing. Uses the `RT` reference prefix. |
| Film Capacitor | Two pins formed to 5.08 mm spacing | WIMA MKS 2 box capacitor, 7.2 × 2.5 mm body with 5.0 mm lead spacing. |
| Fuse Holder | Two pins nine holes (22.86 mm) apart | [Schurter OGN 0031.8201](https://www.schurter.com/en/datasheet/OG__Holder__5x20) open holder for 5 × 20 mm fuses. Its 22.5 mm pin distance leaves each pin under 0.2 mm off a hole center. The 25 mm version (0031.8211) needs a different footprint. |
| DIP Switches, 2-, 4- and 8-position | Two rows 7.62 mm apart, 2.54 mm pitch | Standard through-hole DIP switch, numbered like a DIP IC: pins 1 to *n* along the bottom row, then back along the top. Switch *k* connects pin *k* to the pin directly above it. The housing covers both rows, so the 2D pin numbers sit on the pins themselves. |
| 7-Segment Displays | Two rows of five, 15.24 mm apart | [Kingbright SC56-11](https://www.kingbrightusa.com/images/catalog/SPEC/SC56-11EWA.pdf) (common cathode) and SA56-11 (common anode) 0.56 inch digit, 12.5 × 19.05 mm body. Pins 1–10 are `E`, `D`, common, `C`, `DP`, `B`, `A`, common, `F`, `G`; `CC` and `CA` mark the common pins. |
| Rotary Encoder | `A`, `C`, `B` in a row; switch pins `S1`, `S2` six holes above | [Bourns PEC11R-4xxxF-S](https://www.bourns.com/docs/Product-Datasheets/PEC11R.pdf), 12.5 × 13.4 mm body with a push switch. The 2.5 mm pin pitch is formed to 2.54 mm, and the 14.5 mm row spacing to 15.24 mm. The two wide mounting lugs do not fit perfboard holes and are not part of the footprint; bend them flat or clip them. |
| DC Barrel Jack | Center and sleeve pins two holes apart; switch pin one hole along and two holes to the side | 5.5 × 2.1 mm jack with thin, breadboard-friendly pins ([SparkFun PRT-10811](https://www.sparkfun.com/dc-barrel-jack-adapter-breadboard-compatible.html), [4UCON 18742 drawing](https://cdn.sparkfun.com/datasheets/Prototyping/18742.pdf)). The real pins are 5.8 mm apart along the barrel, and the switch pin is 2.8 mm along and 4.8 mm to the side, so all three are formed to the grid. The opening faces away from the center pin. Jacks with flat solder tabs, such as the PJ-102A, need slotted holes and do not fit this footprint. |

## Switches, LEDs, displays, sensors, connectors, and batteries

| Catalog part | Hole layout | Package reference and assumptions |
| --- | --- | --- |
| LED (3 mm) | Two leads, user-chosen holes | T-1 version of the 5 mm LED, with the same color menu. |
| Tactile Switch (6 × 6 mm) | Four holes on a 7.62 × 5.08 mm rectangle | [Omron B3F-1000](https://omronfs.omron.com/en_US/ecb/products/pdf/en-b3f.pdf), whose pins are 6.5 × 4.5 mm apart, so they are spread slightly to the same span as the KSA push button. Pins are internally connected in pairs; check which pair on your switch with a meter. |
| Latching Push Switch (8 × 8 mm DPDT) | Two rows of three, 2.54 mm pitch, rows two holes apart | Generic self-locking push-on/push-off switch. No manufacturer drawing was found; retailer listings give 2.5 mm pin pitch and 6 mm between rows, so both are formed to the grid. The middle pin of each row is that pole's common. |
| Toggle Switch (MTS-102 SPDT / MTS-202 DPDT) | Three pins two holes apart; the DPDT has a second row two holes above | Generic miniature toggles with 4.7 mm (0.185") pin spacing, formed to 5.08 mm. Body sizes vary between makers, so the outlines are representative. The middle pin of each row is the common. |
| LED Bar Graph (10-segment) | Two rows of ten, 7.62 mm apart | Kingbright DC-10EWA, 25.4 × 10.16 mm. Pins 1–10 (`A1`–`A10`) are the anodes; pins 20–11 (`K1`–`K10`) the matching cathodes, straight above each anode. |
| 4-Digit 7-Segment Displays | Two rows of six, 15.24 mm apart | 0.56 inch four-digit display with the common 5641AS (common cathode) and 5641BS (common anode) pinout: `E`, `D`, `DP`, `C`, `G`, `DG4`, `B`, `DG3`, `DG2`, `F`, `A`, `DG1`. `DG1`–`DG4` are the digit commons, so the digits are multiplexed. Pinouts differ between makers; check yours. |
| DS18B20 Temperature Sensor | Three inline pins, 2.54 mm pitch | Maxim/Analog Devices DS18B20 in TO-92; pins `GND`, `DQ`, `VDD` with the flat face toward you. Uses the transistor artwork and model with its own labels. |
| IR Receiver | Three inline pins, 2.54 mm pitch | [Vishay TSOP38238](https://www.vishay.com/docs/82491/tsop382.pdf): `OUT`, `GND`, `VS`, lens facing forward. VS1838B clones usually share this pinout. |
| DHT22 / DHT11 Humidity Sensors | Four inline pins, 2.54 mm pitch | Aosong bare sensors: DHT22 (AM2302) 15.1 × 25 × 7.7 mm, DHT11 12 × 15.5 × 5.5 mm. Pins `VDD`, `DATA`, `NC`, `GND`. Breakout boards with three pins have a different layout. |
| Electret Microphone | Two adjacent holes, 2.54 mm pitch | [Same Sky CMA-4544PF-W](https://www.sameskydevices.com/product/resource/cma-4544pf-w.pdf), 9.7 mm capsule with PC pins under it. `GND` is the pin connected to the case. |
| Audio Jack (3.5 mm stereo) | Sleeve pin, with tip and ring two holes behind it and two holes to either side | [Same Sky SJ1-3523N](https://www.sameskydevices.com/product/resource/sj1-352xn.pdf), opening to the right. The real pins are 5.0 mm apart, formed to 5.08 mm. |
| JST XH Connectors (2-, 3- and 4-pin) | One row, 2.54 mm pitch | [JST XH](https://www.jst-mfg.com/product/pdf/eng/eXH.pdf) top-entry headers (B2B-XH-A family). Their 2.5 mm pitch is formed to 2.54 mm; across four pins that is 0.12 mm in total. |
| Coin Cell Holder (CR2032) | Two pins eight holes (20.32 mm) apart | Generic open holder with PC pins about 20 mm apart across the cell, such as the MPD BS-7. Pin positions vary between makers; check yours. |
| Battery Holder (2 × AA) | Two pins five holes (12.7 mm) apart at one end | [Keystone 2462](https://www.keyelco.com/userAssets/file/M65p28.pdf), 59.5 × 32.9 mm. Both terminals are on the same end, so the 12.7 mm spacing fits the grid exactly. |
| Battery Holder (18650) | Two pins 28 holes (71.12 mm) apart | [Keystone 1043](https://www.keyelco.com/userAssets/file/K75p29.pdf) through-hole holder, 77.1 × 20.7 mm. Its contacts are 71.6 mm apart, under 0.25 mm off a hole at each end. |

IC sockets are not included. Placing a socket and a chip on the same holes needs the editor to understand stacked parts, so it is left for a later change.

## TO-220 regulators

The 7805 and LM317 use three inline pins at 2.54 mm pitch and share the existing upright TO-220 package artwork. Viewed from the marked front, pins run left to right:

| Catalog part | Pin 1 | Pin 2 | Pin 3 | Reference |
| --- | --- | --- | --- | --- |
| 7805 | IN | GND | OUT | [Texas Instruments LM340/LM7805 datasheet](https://www.ti.com/lit/ds/symlink/lm340.pdf), NDE TO-220 pin configuration |
| LM317 | ADJ | OUT | IN | [Texas Instruments LM317 datasheet](https://www.ti.com/lit/ds/symlink/lm317.pdf), NDE TO-220 pin configuration |

Their pin assignments differ even though the bodies look alike. The models represent upright packages without a heatsink.
