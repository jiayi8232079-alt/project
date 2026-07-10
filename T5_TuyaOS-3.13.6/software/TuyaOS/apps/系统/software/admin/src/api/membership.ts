import { get, post, put, del } from './request'

export function getUserMembership(userId: number) {
  return get(`/membership/users/${userId}`)
}

export function updateUserMembership(userId: number, data: any) {
  return put(`/membership/users/${userId}`, data)
}

export function getAnnualCardMembers() {
  return get('/membership/annual-members')
}

export function grantAnnualCard(userId: number, data: { startDate?: string; expireDate?: string }) {
  return post(`/membership/users/${userId}/annual`, data)
}

export function revokeAnnualCard(userId: number) {
  return del(`/membership/users/${userId}/annual`)
}
