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

All pins are labelled. On the PC817, pins 1–4 are `A` (anode), `K` (cathode), `E` (emitter), and `C` (collector); these short labels remain readable when rotated. On the 74HC595, `/SRCLR` and `/OE` indicate active-low inputs, and `QH'` is the serial output. On the ULN2803A, `1B` through `8B` are the driver inputs, `1C` through `8C` are their collector outputs, and `COM` is the clamp-diode common connection.

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

## TO-220 regulators

The 7805 and LM317 use three inline pins at 2.54 mm pitch and share the existing upright TO-220 package artwork. Viewed from the marked front, pins run left to right:

| Catalog part | Pin 1 | Pin 2 | Pin 3 | Reference |
| --- | --- | --- | --- | --- |
| 7805 | IN | GND | OUT | [Texas Instruments LM340/LM7805 datasheet](https://www.ti.com/lit/ds/symlink/lm340.pdf), NDE TO-220 pin configuration |
| LM317 | ADJ | OUT | IN | [Texas Instruments LM317 datasheet](https://www.ti.com/lit/ds/symlink/lm317.pdf), NDE TO-220 pin configuration |

Their pin assignments differ even though the bodies look alike. The models represent upright packages without a heatsink.
