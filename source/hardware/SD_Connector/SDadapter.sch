EESchema Schematic File Version 4
EELAYER 30 0
EELAYER END
$Descr A4 11693 8268
encoding utf-8
Sheet 1 1
Title ""
Date ""
Rev ""
Comp ""
Comment1 ""
Comment2 ""
Comment3 ""
Comment4 ""
$EndDescr
$Comp
L Connector_Generic:Conn_02x04_Odd_Even J1
U 1 1 5EED097B
P 6400 3250
F 0 "J1" H 6450 3475 50  0000 C CNN
F 1 "Conn_02x04_Odd_Even" H 6450 3476 50  0001 C CNN
F 2 "Connector_PinSocket_2.54mm:PinSocket_2x04_P2.54mm_Horizontal" H 6400 3250 50  0001 C CNN
F 3 "~" H 6400 3250 50  0001 C CNN
	1    6400 3250
	1    0    0    -1  
$EndComp
$Comp
L power:GND #PWR0103
U 1 1 5EEF588B
P 2700 4750
F 0 "#PWR0103" H 2700 4500 50  0001 C CNN
F 1 "GND" H 2705 4577 50  0000 C CNN
F 2 "" H 2700 4750 50  0001 C CNN
F 3 "" H 2700 4750 50  0001 C CNN
	1    2700 4750
	1    0    0    -1  
$EndComp
Wire Wire Line
	3300 3050 3850 3050
Wire Wire Line
	3300 3750 3400 3750
Text Label 3850 3050 0    50   ~ 0
3V3
Text Label 3850 4150 0    50   ~ 0
SD_MUX_SEL
$Comp
L Connector:USB_C_Receptacle_USB2.0 J2
U 1 1 5EED1B44
P 2700 3650
F 0 "J2" H 2807 4517 50  0000 C CNN
F 1 "USB_C_Receptacle_USB2.0" H 2807 4426 50  0000 C CNN
F 2 "Connector_USB:USB_C_Receptacle_GCT_USB4085" H 2850 3650 50  0001 C CNN
F 3 "https://www.usb.org/sites/default/files/documents/usb_type-c.zip" H 2850 3650 50  0001 C CNN
	1    2700 3650
	1    0    0    -1  
$EndComp
Text Label 3850 3550 0    50   ~ 0
USB_DN
Text Label 3850 3750 0    50   ~ 0
USB_DP
Wire Wire Line
	3300 3550 3400 3550
Wire Wire Line
	3300 3650 3400 3650
Wire Wire Line
	3400 3650 3400 3550
Connection ~ 3400 3550
Wire Wire Line
	3400 3550 3850 3550
Wire Wire Line
	3300 3850 3400 3850
Wire Wire Line
	3400 3850 3400 3750
Connection ~ 3400 3750
Wire Wire Line
	3400 3750 3850 3750
Text Label 3850 3250 0    50   ~ 0
RESET_N
Wire Wire Line
	3300 4150 3400 4150
$Comp
L power:GND #PWR0102
U 1 1 5EEDA982
P 5700 3600
F 0 "#PWR0102" H 5700 3350 50  0001 C CNN
F 1 "GND" H 5705 3427 50  0000 C CNN
F 2 "" H 5700 3600 50  0001 C CNN
F 3 "" H 5700 3600 50  0001 C CNN
	1    5700 3600
	1    0    0    -1  
$EndComp
Wire Wire Line
	5700 3450 5700 3600
Text Label 5700 3250 0    50   ~ 0
SD_MUX_SEL
Text Label 5700 3150 0    50   ~ 0
3V3
Wire Wire Line
	5700 3450 6200 3450
Wire Wire Line
	6200 3350 5700 3350
Wire Wire Line
	6200 3250 5700 3250
Wire Wire Line
	6200 3150 5700 3150
Wire Wire Line
	7000 2950 7250 2950
Wire Wire Line
	7000 3150 7000 2950
Wire Wire Line
	6700 3150 7000 3150
Text Label 7150 3450 0    50   ~ 0
RESET_N
Text Label 7150 3350 0    50   ~ 0
USB_DN
Text Label 7150 3250 0    50   ~ 0
USB_DP
$Comp
L power:GND #PWR0101
U 1 1 5EEDAD19
P 7250 2950
F 0 "#PWR0101" H 7250 2700 50  0001 C CNN
F 1 "GND" H 7255 2777 50  0000 C CNN
F 2 "" H 7250 2950 50  0001 C CNN
F 3 "" H 7250 2950 50  0001 C CNN
	1    7250 2950
	1    0    0    -1  
$EndComp
Wire Wire Line
	6700 3450 7150 3450
Wire Wire Line
	6700 3350 7150 3350
Wire Wire Line
	6700 3250 7150 3250
Wire Wire Line
	2700 4550 2700 4750
NoConn ~ 2400 4550
Wire Wire Line
	3300 3250 3400 3250
Wire Wire Line
	3300 4250 3400 4250
Wire Wire Line
	3400 4250 3400 4150
Connection ~ 3400 4150
Wire Wire Line
	3400 4150 3850 4150
Wire Wire Line
	3300 3350 3400 3350
Wire Wire Line
	3400 3350 3400 3250
Connection ~ 3400 3250
Wire Wire Line
	3400 3250 3850 3250
$Comp
L Jumper:SolderJumper_2_Open JP1
U 1 1 5EEDD095
P 5550 3350
F 0 "JP1" H 5550 3450 50  0000 C CNN
F 1 "SolderJumper_2_Open" H 5550 3464 50  0001 C CNN
F 2 "Jumper:SolderJumper-2_P1.3mm_Open_Pad1.0x1.5mm" H 5550 3350 50  0001 C CNN
F 3 "~" H 5550 3350 50  0001 C CNN
	1    5550 3350
	1    0    0    -1  
$EndComp
Text Label 4950 3350 0    50   ~ 0
VBUS_DET
Wire Wire Line
	4950 3350 5400 3350
$EndSCHEMATC
