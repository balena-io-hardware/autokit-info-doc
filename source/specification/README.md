# Writing the `spec.json`

The `spec.json` is the designers way of communicating with balena CI, and the manufacturing lab. This has
- all the necessary information that's missing from the design files
- meta information about the design

**NOTE : If spec.json is missing or misformed, the hardware process will fail to proceed with your Pull Request**

Here's a sample `spec.json` for your PCB projects

```json
{
    "name": "PCB",
    "description": "PCB DESCRIPTION",
    "hwType" : "pcb",
    "manufacture" : [
        {
            "name": "PCB NAME",
            "parameters": {
                "quantity": 1,
                "material" : "MATERIAL",
                "surface-finish": "FINISH"
            }
        }
    ]
}

```

Here's a sample `spec.json` for your 3D projects

```json
{
    "name": "RPi Heatsink",
    "description": "Heatsink",
    "hwType" : "3d",
    "manufacture" : [
        {
            "name": "Heatsink",
            "parameters": {
                "thickness" : "2mm",
                "quantity": 1,
                "material" : "Copper",
                "material-type": "C101",
                "finish" : "Smoothed",
                "details" : "Etched with logo"
            }
        }
    ]
}
```

Once you have populated the `spec.json`, use https://jsonlint.com/ to check if your file is formatted correctly.
