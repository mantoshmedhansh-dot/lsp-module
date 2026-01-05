import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@cjdquick/database";

// Consumer App Authentication API
// OTP-based phone authentication for end customers

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "SEND_OTP": {
        const { phone } = body;

        if (!phone || phone.length < 10) {
          return NextResponse.json(
            { success: false, error: "Invalid phone number" },
            { status: 400 }
          );
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // In production, send OTP via SMS gateway (Twilio, MSG91, etc.)
        // await sendSMS(phone, `Your CJDarcl Quick verification code is: ${otp}`);

        // Store OTP in cache/DB (for demo, we'll use a simple approach)
        // In production, use Redis with TTL

        // For demo, return OTP (remove in production!)
        return NextResponse.json({
          success: true,
          data: {
            message: "OTP sent successfully",
            expiresIn: 300, // 5 minutes
            // Remove in production:
            debugOtp: process.env.NODE_ENV === "development" ? otp : undefined,
          },
        });
      }

      case "VERIFY_OTP": {
        const { phone, otp } = body;

        // In production, verify OTP from cache/DB
        // For demo, accept any 6-digit OTP
        if (!otp || otp.length !== 6) {
          return NextResponse.json(
            { success: false, error: "Invalid OTP" },
            { status: 400 }
          );
        }

        // Find or create consumer user
        let consumer = await prisma.consumerUser.findUnique({
          where: { phone },
        });

        if (!consumer) {
          consumer = await prisma.consumerUser.create({
            data: {
              phone,
              phoneVerified: true,
            },
          });
        } else {
          // Update last active
          await prisma.consumerUser.update({
            where: { id: consumer.id },
            data: {
              phoneVerified: true,
              lastActiveAt: new Date(),
            },
          });
        }

        // Generate session token
        const token = generateToken();

        return NextResponse.json({
          success: true,
          data: {
            user: {
              id: consumer.id,
              phone: consumer.phone,
              name: consumer.name,
              email: consumer.email,
              isNewUser: !consumer.name,
            },
            token,
            expiresIn: 86400 * 30, // 30 days
          },
        });
      }

      case "UPDATE_PROFILE": {
        const { consumerId, name, email } = body;

        const consumer = await prisma.consumerUser.update({
          where: { id: consumerId },
          data: {
            name,
            email,
            emailVerified: false, // Require verification if email changed
          },
        });

        return NextResponse.json({ success: true, data: consumer });
      }

      case "UPDATE_FCM_TOKEN": {
        const { consumerId, fcmToken, deviceType, appVersion } = body;

        const consumer = await prisma.consumerUser.update({
          where: { id: consumerId },
          data: {
            fcmToken,
            deviceType,
            appVersion,
            lastActiveAt: new Date(),
          },
        });

        return NextResponse.json({ success: true, data: { message: "Token updated" } });
      }

      case "UPDATE_PREFERENCES": {
        const { consumerId, preferences } = body;

        const consumer = await prisma.consumerUser.update({
          where: { id: consumerId },
          data: {
            language: preferences.language,
            notifyViaPush: preferences.notifyViaPush,
            notifyViaSms: preferences.notifyViaSms,
            notifyViaEmail: preferences.notifyViaEmail,
            notifyViaWhatsApp: preferences.notifyViaWhatsApp,
          },
        });

        return NextResponse.json({ success: true, data: consumer });
      }

      case "ADD_ADDRESS": {
        const { consumerId, address } = body;

        // If setting as default, unset other defaults
        if (address.isDefault) {
          await prisma.consumerAddress.updateMany({
            where: { consumerId },
            data: { isDefault: false },
          });
        }

        const newAddress = await prisma.consumerAddress.create({
          data: {
            consumerId,
            label: address.label,
            name: address.name,
            phone: address.phone,
            address: address.address,
            landmark: address.landmark,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            latitude: address.latitude,
            longitude: address.longitude,
            isDefault: address.isDefault || false,
          },
        });

        return NextResponse.json({ success: true, data: newAddress });
      }

      case "GET_ADDRESSES": {
        const { consumerId } = body;

        const addresses = await prisma.consumerAddress.findMany({
          where: { consumerId },
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        });

        return NextResponse.json({ success: true, data: addresses });
      }

      case "DELETE_ADDRESS": {
        const { addressId } = body;

        await prisma.consumerAddress.delete({ where: { id: addressId } });

        return NextResponse.json({ success: true, data: { message: "Address deleted" } });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in consumer auth API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process request" },
      { status: 500 }
    );
  }
}

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
