import os
import smtplib
from email.message import EmailMessage

from flask import Blueprint, jsonify, request

contact_bp = Blueprint("contact", __name__, url_prefix="/api")

MAX_MESSAGE_LENGTH = 5000


@contact_bp.route("/contact", methods=["POST"])
def send_contact():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing request body"}), 400

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    message = (data.get("message") or "").strip()

    if not name or not email or not message:
        return jsonify({"error": "All fields are required"}), 400

    if len(message) > MAX_MESSAGE_LENGTH:
        return jsonify({"error": "Message too long"}), 400

    # Build the email
    recipient = os.environ.get("CONTACT_EMAIL", "crg167@gmail.com")
    smtp_host = os.environ.get("SMTP_HOST", "localhost")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASS", "")

    msg = EmailMessage()
    msg["Subject"] = f"[chrisgonzalez.dev] Message from {name}"
    msg["From"] = smtp_user or recipient
    msg["To"] = recipient
    msg["Reply-To"] = email
    msg.set_content(
        f"Name: {name}\nEmail: {email}\n\n{message}"
    )

    try:
        if smtp_user and smtp_pass:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
        # If no SMTP configured, just log it (dev mode)
        else:
            print(f"[Contact Form] From: {name} <{email}>\n{message}")
    except Exception:
        return jsonify({"error": "Failed to send message"}), 500

    return jsonify({"status": "sent"}), 200
