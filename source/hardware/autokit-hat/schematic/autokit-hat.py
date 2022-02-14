from pcbflow import *
from skidl import *

rpiHeader = Part("Connector", "Raspberry_Pi_2_3", footprint="Samtec_HLE-120-02-xx-DV-TE_2x20_P2.54mm_Horizontal")
usbHeaderOut = Part("Connector", "USB_C_Receptacle_USB2.0", footprint="USB_C_Receptacle_GCT_USB4085")
usbHeaderIn = Part("Connector", "USB_C_Receptacle_USB2.0", footprint="USB_C_Receptacle_GCT_USB4085")

print(show("Connector", "Raspberry_Pi_2_3"))
print(show("Connector", "USB_C_Receptacle_USB2.0"))


# create the nets
gnd, vcc = Net("GND"), Net("VCC")
sd_mux_sel = Net("SD_MUX_SEL")
sd_mux_rst = Net("SD_MUX_RST")
usb_dn = Net("USB_DN")
usb_pn = Net("USB_PN")


# Make connections GPIO header and USB header
rpiHeader["GPIO23"] & sd_mux_sel & usbHeaderOut["SBU1"] # sd mux sel
rpiHeader["GPIO23"] & sd_mux_sel & usbHeaderOut["SBU2"] # sd mux sel
rpiHeader["GPIO24"] & sd_mux_rst & usbHeaderOut["CC1"] # reset
rpiHeader["GPIO24"] & sd_mux_rst & usbHeaderOut["CC2"] # reset

usbHeaderIn['A6'] & usbHeaderIn['B6'] & usb_pn & usbHeaderOut['A6'] & usbHeaderOut['B6']
usbHeaderIn['A7'] & usbHeaderIn['B7'] & usb_dn & usbHeaderOut['A7'] & usbHeaderOut['B7']
usbHeaderIn['A1'] & gnd & usbHeaderOut['A1']
usbHeaderIn['A12'] & gnd & usbHeaderOut['A12']
usbHeaderIn['B1'] & gnd & usbHeaderOut['B1']
usbHeaderIn['B12'] & gnd & usbHeaderOut['B12']

usbHeaderIn['B4'] & vcc & usbHeaderOut['B4']
usbHeaderIn['A9'] & vcc & usbHeaderOut['A9']
usbHeaderIn['A4'] & vcc & usbHeaderOut['A4']
usbHeaderIn['B9'] & vcc & usbHeaderOut['B9']

#usbHeaderIn['VBUS'] & vcc & usbHeaderOut['VBUS']


generate_netlist()


## Generate board

# brd = Board((65, 30))
# brd.add_outline()
# # fill the top and bottom copper layers and merge nets named "GND"
# #brd.fill_layer("GTL", "GND")
# brd.fill_layer("GBL", "GND")

# rpiHeaderBoard = SkiPart(brd.DC((8, 26)), rpiHeader, side="top")
# usbHeaderBoard = SkiPart(brd.DC((10, 5)), usbHeader, side="top")

# print(usbHeaderBoard)
# #rpiHeaderBoard.pad("SD_MUX_SEL").turtle("r 0 b 20 l 90 f 10").wire(width=0.25)  
# usbHeaderBoard.pad("SD_MUX_RST").w("r 180 f 3 l 90 f 20 l90 f18").wire(width=0.25)     
# usbHeaderBoard.pad("SD_MUX_SEL").w("r 180 f 4 l 90 f 24.2 l90 f20").wire(width=0.25)  

# # save the PCB asset files
# brd.save("mypcb")